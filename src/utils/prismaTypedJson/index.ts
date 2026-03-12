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
	dateTime: 'Date',
	DateTime: 'Date',
	date: 'Date',
	Date: 'Date',
	bigInt: 'String',
	BigInt: 'String',
	decimal: 'Float',
	Decimal: 'Float',
	bytes: 'String',
	Bytes: 'String',
};

const JSON_TYPE_PREFIX = 'JSON_';

function prefixTypeName(name: string): string {
	return name.startsWith(JSON_TYPE_PREFIX) ? name : `${JSON_TYPE_PREFIX}${name}`;
}

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
			if (fieldMatch) {
				const rawType = fieldMatch[2];
				const isList = rawType.endsWith('[]');
				const isNullable = rawType.endsWith('?');
				const baseType = rawType.replace(/\[\]$/, '').replace(/\?$/, '');
				const mapped = GQL_TYPE_MAP[baseType];
				const resolvedBase = mapped ?? prefixTypeName(baseType);
				fields[fieldMatch[1]] = `${resolvedBase}${isNullable ? '?' : ''}${isList ? '[]' : ''}`;
			}
		}
		typeObjects[prefixTypeName(headerMatch[1])] = fields;
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
			if (fieldMatch) {
				const rawAnnotation = fieldMatch[2];
				const isList = rawAnnotation.endsWith('[]');
				const baseType = rawAnnotation.replace(/\[\]$/, '').replace(/\?$/, '');
				result[`${modelName}.${fieldMatch[1]}`] = `${prefixTypeName(baseType)}${isList ? '[]' : ''}`;
			}
		}
	}
	return result;
}

export function generateJsonTypeDefs(schemaContent: string): string {
	const typeObjects = extractCommentedTypes(schemaContent);
	return Object.entries(typeObjects)
		.map(([typeName, fields]) => {
			const fieldDefs = Object.entries(fields)
				.map(([fieldName, resolvedType]) => {
					const isList = resolvedType.endsWith('[]');
					const isNullable = resolvedType.endsWith('?');
					const baseType = resolvedType.replace(/\[\]$/, '').replace(/\?$/, '');
					const typeStr = isList
						? `[${baseType}!]${isNullable ? '' : '!'}`
						: `${baseType}${isNullable ? '' : '!'}`;
					return `  ${fieldName}: ${typeStr}`;
				})
				.join('\n');
			return `type ${typeName} {\n${fieldDefs}\n}`;
		})
		.join('\n\n');
}
