import type { CfnDataSource } from "aws-cdk-lib/aws-appsync";

export function getCfnDataSourceFromResolverLogicalId(
  logicalId: string,
  cfnDataSources: Record<string, CfnDataSource>
): CfnDataSource {
  const fieldName = logicalId.split(".")[1];
  const modelName = fieldName.replace(/^(create|update|delete)/, "");
  const dataSourceName = `${modelName}Table`;
  const dataSource = cfnDataSources[dataSourceName];
  if (!dataSource) {
    throw new Error(`DataSource ${dataSourceName} not found for resolver ${logicalId}`);
  }
  return dataSource;
}
