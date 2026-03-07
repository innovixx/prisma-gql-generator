# prisma-gql-generator

A Prisma generator that outputs a GraphQL schema based on your Prisma models and enums.

## Features
- Generates a GraphQL schema (`index.graphql`) from your Prisma schema
- Supports Prisma models and enums
- Outputs to the configured generator output directory

## Usage
1. Add this generator to your `schema.prisma`:

```
generator gql {
  provider = "@innovixx/prisma-gql-generator"
  output   = "./generated"
}
```

2. Run Prisma generate:

```
npx prisma generate
```

3. Find the generated `index.graphql` in your output directory.

## License

MIT
