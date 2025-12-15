import { mkdir, writeFile } from "fs/promises";

import openapi from "../openapi.json" assert { type: 'json' };

const targetDirectory = "src/lib/spotify/model";

async function generateSpotifyClient() {
  console.log("\nLaunched generate-spotify-client script");
  console.log('Generating Spotify client from OpenApi spec file...\n')
  await mkdir(targetDirectory, { recursive: true }); // Generate target directory

  const schemas = openapi.components.schemas;
  const typesToGenerate = Object.keys(schemas);

  for (const typeName of typesToGenerate) {
    const typeSchema = schemas[typeName];
    generateType(typeName, typeSchema);
  }
}

function generateType(typeName, typeSchema) {  
  console.log(`Generating type ${typeName}...`);

  const generatedCode = getGeneratedCode(typeName, typeSchema);

  writeFile(`${targetDirectory}/${typeName}.ts`, generatedCode);
}

function getGeneratedCode(typeName, typeSchema) {
  var imports = [];
  const generatedType = getGeneratedType(typeSchema, imports);
  const imports_def = imports.length === 0 ? "" :
    imports.map(key => `import { ${key} } from "./${key}";\n`).join("") + "\n";
  const type_def = `export type ${typeName} = ${generatedType};`;

  return imports_def + type_def;
}

function is_undefined(x) {
  return typeof x === "undefined";
}

function getGeneratedType(typeSchema, imports) {
  if (!is_undefined(typeSchema.oneOf)) {
    return "(" + typeSchema.oneOf.map(schema =>
      getGeneratedType(schema, imports)).join(" | ") + ")";
  }

  if (!is_undefined(typeSchema.allOf)) {
    return "(" + typeSchema.allOf.map(schema =>
      getGeneratedType(schema, imports)).join(" & ") + ")";
  }

  if (!is_undefined(typeSchema["$ref"])) {
    const imported_type = typeSchema["$ref"].replace("#/components/schemas/", "");
    if (!imports.includes(imported_type)) {
      imports.push(imported_type);
    }
    return imported_type;
  }

  const schemaType = typeSchema.type;
  switch (schemaType) {
    case "number":
    case "integer":
      return "number";
    case "string":
      if (!is_undefined(typeSchema.enum)) {
        return typeSchema.enum.map(e => `"${e}"`).join(" | ");
      }
    case "boolean":
      return schemaType;
    case "array":
      return getGeneratedType(typeSchema.items, imports) + "[]";
    case "object":
      const required = !is_undefined(typeSchema.required) ? typeSchema.required : [];
      return "{\n" + Object.entries(typeSchema.properties).map(([key, value]) =>
        `  ${key}${required.includes(key) ? "" : "?"}: ${getGeneratedType(value, imports)};`
      ).join("\n") + "\n}";
    default:
      return "";
  }
}

generateSpotifyClient();