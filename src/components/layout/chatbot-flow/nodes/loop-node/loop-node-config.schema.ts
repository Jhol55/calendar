import { z } from 'zod';

export const loopConfigSchema = z
  .object({
    // Input data
    inputData: z.string().min(1, 'Digite os dados de entrada'),

    // Loop settings
    batchSize: z.union([z.string(), z.number()]).optional(),
    mode: z.enum(['each', 'batch']),

    // Output settings
    accumulateResults: z.boolean().optional(),
    outputVariable: z.string().optional(),

    // Loop control
    maxIterations: z.union([z.string(), z.number()]).optional(),
    pauseBetweenIterations: z.union([z.string(), z.number()]).optional(),

    // Memory config
    memoryAction: z.string().optional(),
    memoryName: z.string().optional(),
    memorySaveMode: z.enum(['overwrite', 'append']).optional(),
    memoryDefaultValue: z.string().optional(),
    memoryItems: z.array(z.any()).optional(),
    memoryTtlPreset: z.string().optional(),
    memoryCustomTtl: z.union([z.string(), z.number()]).optional(),
  })
  .refine(
    (data) => {
      // Validar batch size se mode for 'batch'
      if (data.mode === 'batch') {
        const batchSize =
          typeof data.batchSize === 'string'
            ? parseInt(data.batchSize)
            : data.batchSize;
        return batchSize && batchSize > 0;
      }
      return true;
    },
    {
      message: 'Digite um tamanho de lote válido (maior que 0)',
      path: ['batchSize'],
    },
  )
  .refine(
    (data) => {
      // Validar maxIterations se fornecido
      if (data.maxIterations) {
        const maxIter =
          typeof data.maxIterations === 'string'
            ? parseInt(data.maxIterations)
            : data.maxIterations;
        return maxIter && maxIter > 0;
      }
      return true;
    },
    {
      message: 'Digite um limite de iterações válido (maior que 0)',
      path: ['maxIterations'],
    },
  );

export type LoopConfigSchema = z.infer<typeof loopConfigSchema>;
