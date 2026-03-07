import generatorHelper, { GeneratorOptions } from '@prisma/generator-helper';
import internals from '@prisma/internals';
import path from 'path';
import fs from 'fs';
import pkg from '../package.json' with { type: "json" };

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

function prismaToGraphQL(models: any[], enums: any[]): string {
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
					const gqlType = PRISMA_TYPE_MAP[field.type] || field.type;
					const typeStr = field.isList
						? `[${gqlType}${field.isRequired ? '!' : ''}]`
						: `${gqlType}${field.isRequired ? '!' : ''}`;
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

		const graphqlSchema = prismaToGraphQL(models, enums);

		const outputDir = options.generator.output?.value || './generated';
		const graphqlPath = path.join(outputDir, 'index.graphql');
		fs.mkdirSync(path.dirname(graphqlPath), { recursive: true });
		fs.writeFileSync(graphqlPath, graphqlSchema);

		logger.info(`@innovixx/prisma-gql-generator:Generated ${graphqlPath}`);
	},
});
