import generatorHelper, { GeneratorOptions } from '@prisma/generator-helper';
import internals from '@prisma/internals';
import path from 'path';
import fs from 'fs';
import pkg from '../package.json' with { type: "json" };
import { generateJsonTypeDefs, extractJsonTypeAnnotations } from './utils/prismaTypedJson/index.js';

const { generatorHandler } = generatorHelper;
const { logger } = internals;

const PRISMA_TYPE_MAP: Record<string, string> = {
	String: 'String',
	Int: 'Int',
	Boolean: 'Boolean',
	Float: 'Float',
	DateTime: 'Date',
	Json: 'JSON',
};

function prismaToGraphQL(models: any[], enums: any[], jsonTypeOverrides: Record<string, string> = {}): string {
	const enumDefs = enums
		.map((e) => {
			const values = e.values.map((v: string) => `  ${v}`).join('\n');
			return `enum ${e.name} {\n${values}\n}`;
		})
		.join('\n\n');

	const modelDefs = models
		.map((model) => {
			const fields = model.fields
				.map((field: any) => {
					const override = jsonTypeOverrides[`${model.name}.${field.name}`];
					let typeStr: string;
					if (field.type === 'Json' && override) {
						const isList = override.endsWith('[]');
						const baseType = override.replace(/\[\]$/, '').replace(/\?$/, '');
						typeStr = isList
							? `[${baseType}!]${field.isRequired ? '!' : ''}`
							: `${baseType}${field.isRequired ? '!' : ''}`;
					} else {
						const gqlType = PRISMA_TYPE_MAP[field.type] || field.type;
						typeStr = field.isList
							? `[${gqlType}${field.isRequired ? '!' : ''}]`
							: `${gqlType}${field.isRequired ? '!' : ''}`;
					}
					return `  ${field.name}: ${typeStr}`;
				})
				.join('\n');
			return `type ${model.name} {\n${fields}\n}`;
		})
		.join('\n\n');

	return [enumDefs, modelDefs].filter(Boolean).join('\n\n');
}

generatorHandler({
	onManifest() {
		return {
			version: pkg.version,
			defaultOutput: '../generated',
			prettyName: '@innovixx/prisma-gql-generator',
		};
	},
	async onGenerate(options: GeneratorOptions) {
		logger.info('@innovixx/prisma-gql-generator:Generating GraphQL schema...');

		const models = options.dmmf.datamodel.models.map((model) => ({
			name: model.name,
			fields: model.fields.map((field) => ({
				name: field.name,
				type: field.type,
				isList: field.isList,
				isRequired: field.isRequired,
			})),
		}));

		const enums = options.dmmf.datamodel.enums.map((e) => ({
			name: e.name,
			values: e.values.map((v) => v.name),
		}));

		const typedJsonGenerator = options.otherGenerators.find(
			(g) => g.provider.value?.includes('prisma-typed-json-generator'),
		);

		let jsonTypeOverrides: Record<string, string> = {};
		const schemaParts: string[] = [];

		if (typedJsonGenerator) {
			const schemaContent = await fs.promises.readFile(options.generator.sourceFilePath, 'utf-8');
			jsonTypeOverrides = extractJsonTypeAnnotations(schemaContent);
			const jsonTypeDefs = generateJsonTypeDefs(schemaContent);
			if (jsonTypeDefs) schemaParts.push(jsonTypeDefs);
		}

		schemaParts.unshift(prismaToGraphQL(models, enums, jsonTypeOverrides));

		const graphqlSchema = schemaParts.filter(Boolean).join('\n\n');

		const outputDir = options.generator.output?.value || './generated';
		const graphqlPath = path.join(outputDir, 'index.graphql');
		fs.mkdirSync(path.dirname(graphqlPath), { recursive: true });
		fs.writeFileSync(graphqlPath, graphqlSchema);

		logger.info(`@innovixx/prisma-gql-generator:Generated ${graphqlPath}`);
	},
});
