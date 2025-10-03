import { CfnDataSource } from "aws-cdk-lib/aws-appsync";

export function getCfnDataSourceToUpdateAndDeleteFromResolverLogicalId(
  logicalId: string,
  cfnDataSources: Record<string, CfnDataSource>
): CfnDataSource {
  const fieldName = logicalId.split(".")[1];
  const modelName = fieldName.replace(/^(update|delete)/, "");
  const dataSourceName = `${modelName}Table`;
  const dataSource = cfnDataSources[dataSourceName];
  if (!dataSource) {
    throw new Error(
      `DataSource ${dataSourceName} not found for resolver ${logicalId}`
    );
  }
  return dataSource;
}

export function getCfnDataSourceToCreateFromResolverLogicalId(
  logicalId: string,
  cfnDataSources: Record<string, CfnDataSource>
): CfnDataSource | null {
  const fieldName = logicalId.split(".")[1];
  const modelName = fieldName.replace(/^create/, "");
  const parentModelName = getParentModelName(modelName);
  if (parentModelName) {
    const dataSourceName = `${parentModelName}Table`;
    const dataSource = cfnDataSources[dataSourceName];
    if (!dataSource) {
      throw new Error(
        `DataSource ${dataSourceName} not found for resolver ${logicalId}`
      );
    }
    return dataSource;
  }
  return null;
}

function getParentModelName(modelName: string): string | undefined {
  return { File: "Folder", Folder: "Project" }[modelName];
}
