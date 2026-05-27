import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

type VariantDefinition = Record<string, Record<string, ClassValue>>

type VariantPropsFromConfig<Variants extends VariantDefinition | undefined> = Variants extends VariantDefinition
  ? {
      [K in keyof Variants]?: keyof Variants[K]
    }
  : {}

export type VariantProps<T extends (...args: any) => any> = T extends (props?: infer Props) => any
  ? Props extends Record<string, any>
    ? Omit<Props, "class" | "className">
    : never
  : never

export function cva<Variants extends VariantDefinition | undefined = undefined>(
  base: ClassValue,
  config?: {
    variants?: Variants
    defaultVariants?: Variants extends VariantDefinition
      ? {
          [K in keyof Variants]?: keyof Variants[K]
        }
      : {}
  },
) {
  type Props = VariantPropsFromConfig<Variants> & { className?: ClassValue } & Record<string, any>

  return (props?: Props) => {
    if (!config?.variants) {
      return twMerge(clsx(base, props?.className))
    }

    const { className, ...variantProps } = props || {}
    const variants = Object.entries(variantProps).map(([key, value]) => {
      return config.variants?.[key]?.[value as string]
    })

    return twMerge(clsx(base, variants, className))
  }
}
