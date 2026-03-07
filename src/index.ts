import generatorHelper, { GeneratorOptions } from '@prisma/generator-helper';
import internals from '@prisma/internals'
import path from 'path'
import { genEnum } from './utils/getEnum/index.js'
import pkg from '../package.json' with { type: "json" }
import fs from 'fs'

const { generatorHandler } = generatorHelper;
const { logger } = internals;

generatorHandler({
	onManifest() {
		return {
			version: pkg.version,
			defaultOutput: '../generated',
			prettyName: "prisma-generator-boilerplate",
		}
	},
	onGenerate: async (options: GeneratorOptions) => {
		logger.info(`prisma-generator-boilerplate:Generating...`)

		options.dmmf.datamodel.enums.forEach(async (enumInfo) => {
			const tsEnum = genEnum(enumInfo)

			const writeLocation = path.join(
				options.generator.output?.value!,
				`${enumInfo.name}.ts`,
			)

			fs.mkdirSync(path.dirname(writeLocation), { recursive: true })
			fs.writeFileSync(writeLocation, tsEnum)
		})

		logger.info(`prisma-generator-boilerplate:Generating...Done`)
	},
})
