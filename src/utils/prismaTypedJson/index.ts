const GQL_TYPE_MAP: Record<string, string> = {
	string: 'String',
	String: 'String',
	int: 'Int',
	Int: 'Int',
	float: 'Float',
	Float: 'Float',
	boolean: 'Boolean',
	Boolean: 'Boolean',
	json: 'JSON',
	Json: 'JSON',
};

function extractCommentedTypes(schemaContent: string): Record<string, Record<string, string>> {
	const typeBlockRegex = /\/\/\s*type\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;
	const typeObjects: Record<string, Record<string, string>> = {};
	let match;
	while ((match = typeBlockRegex.exec(schemaContent)) !== null) {
		const headerMatch = /type\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/.exec(match[0]);
		if (!headerMatch) continue;
		const fields: Record<string, string> = {};
		for (const line of headerMatch[2].split('\n')) {
			const cleaned = line.replace(/^\s*\/\//, '').trim();
			if (!cleaned) continue;
			const fieldMatch = /^([A-Za-z0-9_]+)\s+([A-Za-z0-9_\[\]?]+)$/.exec(cleaned);
			if (fieldMatch) fields[fieldMatch[1]] = fieldMatch[2];
		}
		typeObjects[headerMatch[1]] = fields;
	}
	return typeObjects;
}

export function extractJsonTypeAnnotations(schemaContent: string): Record<string, string> {
	const result: Record<string, string> = {};
	const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;
	let modelMatch;
	while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
		const modelName = modelMatch[1];
		const body = modelMatch[2];
		for (const line of body.split('\n')) {
			const fieldMatch = /^\s*([A-Za-z0-9_]+)\s+Json.*@type\(([^)]+)\)/.exec(line);
			if (fieldMatch) result[`${modelName}.${fieldMatch[1]}`] = fieldMatch[2];
		}
	}
	return result;
}

export function generateJsonTypeDefs(schemaContent: string): string {
	const typeObjects = extractCommentedTypes(schemaContent);
	return Object.entries(typeObjects)
		.map(([typeName, fields]) => {
			const fieldDefs = Object.entries(fields)
				.map(([fieldName, prismaType]) => {
					const isList = prismaType.endsWith('[]');
					const isNullable = prismaType.endsWith('?');
					const baseType = prismaType.replace(/\[\]$/, '').replace(/\?$/, '');
					const gqlBase = GQL_TYPE_MAP[baseType] ?? baseType;
					const typeStr = isList
						? `[${gqlBase}!]${isNullable ? '' : '!'}`
						: `${gqlBase}${isNullable ? '' : '!'}`;
					return `  ${fieldName}: ${typeStr}`;
				})
				.join('\n');
			const inputFieldDefs = Object.entries(fields)
				.map(([fieldName, prismaType]) => {
					const isList = prismaType.endsWith('[]');
					const isNullable = prismaType.endsWith('?');
					const baseType = prismaType.replace(/\[\]$/, '').replace(/\?$/, '');
					const gqlBase = GQL_TYPE_MAP[baseType] ?? `${baseType}Input`;
					const typeStr = isList
						? `[${gqlBase}!]${isNullable ? '' : '!'}`
						: `${gqlBase}${isNullable ? '' : '!'}`;
					return `  ${fieldName}: ${typeStr}`;
				})
				.join('\n');
			return `type ${typeName} {\n${fieldDefs}\n}\n\ninput ${typeName}Input {\n${inputFieldDefs}\n}`;
		})
		.join('\n\n');
}
