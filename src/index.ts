import { computed, nextTick, Ref, ref, toValue, watch } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import {
    Bounds,
    LinearConfig,
    modelToStep,
    stepToModel,
    useExponentialSlider,
} from 'wucdbm-exponential-slider'

export function useStepModel(
    model: Ref<Bounds>,
    steps: MaybeRefOrGetter<number>,
    bounds: MaybeRefOrGetter<Bounds>,
    linearConfig?: MaybeRefOrGetter<LinearConfig | undefined>,
    options: {
        watchBounds?: boolean
        fixModelOnInit?: boolean
    } = {
        watchBounds: false,
        fixModelOnInit: false,
    },
): ComputedRef<Bounds> {
    const calculator = computed(() => {
        return useExponentialSlider(
            toValue(steps),
            toValue(bounds),
            toValue(linearConfig),
        )
    })

    const stepModel = computed((): Bounds => {
        const { modelToStep } = calculator.value
        const modelValue = toValue(model)

        return {
            min: Math.round(modelToStep(modelValue.min)),
            max: Math.round(modelToStep(modelValue.max)),
        }
    })

    if (options.watchBounds) {
        watch(bounds, (newBounds, oldBounds) => {
            if (JSON.stringify(newBounds) === JSON.stringify(oldBounds)) {
                return
            }

            // When bounds change, the valueModel will also change to adapt to the current modelValue
            // But the model on the outside will not automatically update

            // For example, with
            // step model { "min": 299, "max": 999 }
            // model value { "min": 11061, "max": 384794 }
            // bounds { "min": 1095, "max": 387680

            // When we go to a filter, and the bounds update
            // It will basically compute the most adequate Step for the current (old) modelValue
            // We then have to re-calculate the modelValue for the selected step
            // As it may be vastly different due to the bounds change
            // The new modelValue will differ only slightly to what it was

            // step model { "min": 324, "max": 909 }
            // model value { "min": 11050, "max": 386447 }
            // bounds { "min": 250, "max": 918205

            // The Slider knob will correctly print 11050
            // But the model value in the URL will still be 11061
            // Instead of the now-correct 11050
            // This will re-calculate the current step as per sliderModel
            // And then emit the correct currency range for the new bounds

            const { stepToModel } = calculator.value

            model.value = {
                min: Math.floor(stepToModel(stepModel.value.min)),
                max: Math.ceil(stepToModel(stepModel.value.max)),
            }
        })
    }

    if (options.fixModelOnInit) {
        const { stepToModel } = calculator.value

        const modelForValueModel = {
            min: Math.floor(stepToModel(stepModel.value.min)),
            max: Math.ceil(stepToModel(stepModel.value.max)),
        }

        if (
            JSON.stringify(modelForValueModel) !== JSON.stringify(model.value)
        ) {
            // This takes care of the above problem in the watcher, but on initial load.
            // We do not know what the bounds have been when a user copied or left this URL in their browser.
            // And they might have changed in the meantime.
            model.value = modelForValueModel
        }
    }

    return stepModel
}

if (import.meta.vitest) {
    const { describe, test, expect } = import.meta.vitest

    describe('Resolve Config', () => {
        function testBackAndForth(
            testName: string,
            steps: number,
            bounds: Bounds,
            linearConfig?: LinearConfig,
        ) {
            test(`${testName}: Test Step to Model and Back via useExponentialSlider`, () => {
                const { stepToModel, modelToStep, config } =
                    useExponentialSlider(steps, bounds, linearConfig)

                for (let step = 0; step <= steps; step++) {
                    const model = stepToModel(step)
                    const stepForModel = modelToStep(model)
                    expect(step).toBe(stepForModel)

                    const inputModel: Ref<Bounds> = ref({
                        min: model,
                        max: config.max,
                    })

                    const sliderModel = useStepModel(
                        inputModel,
                        () => steps,
                        () => bounds,
                        () => linearConfig,
                    )

                    expect(sliderModel.value.min).toBe(step)
                }
            })
        }

        testBackAndForth(
            'Regular Config',
            10_000,
            {
                min: 500,
                max: 125_000,
            },
            {
                maxLinear: 15_000,
                linearPercent: 75,
            },
        )

        test('Changing bounds should change the slider model', () => {
            const steps = 10_000
            const bounds: Ref<Bounds> = ref({
                min: 500,
                max: 125_000,
            })
            const linearConfig: LinearConfig = {
                maxLinear: 15_000,
                linearPercent: 75,
            }

            const step = 8000

            const model = stepToModel(step, steps, bounds.value, linearConfig)
            const stepForModel = modelToStep(
                model,
                steps,
                bounds.value,
                linearConfig,
            )
            expect(step).toBe(stepForModel)

            let _model: Bounds = {
                min: model,
                max: bounds.value.max,
            }
            const inputModel = computed({
                get(): Bounds {
                    return _model
                },
                set(m: Bounds) {
                    _model = m
                },
            })

            const sliderModel = useStepModel(
                inputModel,
                () => steps,
                bounds,
                () => linearConfig,
            )

            expect(sliderModel.value.min).toBe(step)

            bounds.value = {
                min: 1_000,
                max: 105_000,
            }

            expect(sliderModel.value.min).toBe(8022)
        })

        test('Random input model not accounted for current bounds gets fixed on init with flag', () => {
            const steps = 1_000
            const bounds: Ref<Bounds> = ref({
                min: 500,
                max: 125_000,
            })
            const linearConfig: LinearConfig = {
                maxLinear: 15_000,
                linearPercent: 75,
            }

            const inputModel: Ref<Bounds> = ref({
                min: 25491,
                max: bounds.value.max,
            })

            expect(inputModel.value.min).toBe(25491)

            useStepModel(
                inputModel,
                () => steps,
                bounds,
                () => linearConfig,
                {
                    fixModelOnInit: true,
                },
            )

            expect(inputModel.value.min).toBe(25619)
        })

        test('Changing bounds with watchBounds flag on mutates the input model', () => {
            const steps = 1_000
            const bounds: Ref<Bounds> = ref({
                min: 500,
                max: 125_000,
            })
            const linearConfig: LinearConfig = {
                maxLinear: 15_000,
                linearPercent: 75,
            }

            const inputModel: Ref<Bounds> = ref({
                min: 25491,
                max: bounds.value.max,
            })

            expect(inputModel.value.min).toBe(25491)

            useStepModel(
                inputModel,
                () => steps,
                bounds,
                () => linearConfig,
                {
                    watchBounds: true,
                },
            )

            bounds.value = {
                min: 1_000,
                max: 105_000,
            }

            nextTick(() => {
                expect(inputModel.value.min).toBe(25574)
            })
        })

        test('Fix model on init and watch bounds should fix the model immediately and mutate it on bounds change', () => {
            const steps = 1_000
            const bounds: Ref<Bounds> = ref({
                min: 500,
                max: 125_000,
            })
            const linearConfig: LinearConfig = {
                maxLinear: 15_000,
                linearPercent: 75,
            }

            const inputModel: Ref<Bounds> = ref({
                min: 25491,
                max: bounds.value.max,
            })

            expect(inputModel.value.min).toBe(25491)

            useStepModel(
                inputModel,
                () => steps,
                bounds,
                () => linearConfig,
                {
                    fixModelOnInit: true,
                    watchBounds: true,
                },
            )

            expect(inputModel.value.min).toBe(25619)

            bounds.value = {
                min: 1_000,
                max: 105_000,
            }

            nextTick(() => {
                expect(inputModel.value.min).toBe(25574)
            })
        })
    })
}
