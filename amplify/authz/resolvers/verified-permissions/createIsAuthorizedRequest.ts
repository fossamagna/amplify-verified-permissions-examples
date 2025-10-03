import type { AppSyncIdentityCognito, Context } from "@aws-appsync/utils";
import type { File, Folder, Member, Project } from "../types/index";
import type {
  EntityItem,
  EntityIdentifier,
  AttributeValue,
  EntitiesDefinition,
  BatchIsAuthorizedRequest,
} from "./types";

const NAMESPACE = "AmplifyAVP";

export function createBatchIsAuthorizedRequest(
  ctx: Context
): BatchIsAuthorizedRequest {
  const identity = ctx.identity as AppSyncIdentityCognito;
  const userId = identity.claims.sub;
  const members = ctx.stash.userAttributes.members as Member[];
  const policyStoreId = ctx.stash.policyStoreId as string;
  const actionId = `${ctx.stash.typeName}.${ctx.stash.fieldName}`;

  if (!ctx.prev.result || !ctx.prev.result.items || ctx.prev.result.items.length === 0) {
    runtime.earlyReturn(ctx.prev.result);
  }

  const items = ctx.prev.result.items as File[] | Folder[] | Project[];
  // console.log(`Batch items: ${JSON.stringify(items, null, 2)}`);
  const entities = items.map((item) => buildEntityList(item).entityList).flat();
  const resources = items.map((item) => buildResource(item));

  const user = buildUser(userId, members);
  return {
    entities: {
      entityList: [user, ...entities],
    },
    policyStoreId: policyStoreId,
    requests: resources.map((resource) => ({
      action: {
        actionId: actionId,
        actionType: `${NAMESPACE}::Action`,
      },
      context: {},
      principal: user.identifier,
      resource,
    })),
  };
}

export function createIsAuthorizedRequest(ctx: Context) {
  const identity = ctx.identity as AppSyncIdentityCognito;
  const userId = identity.claims.sub;
  const members = ctx.stash.userAttributes.members as Member[];
  const policyStoreId = ctx.stash.policyStoreId as string;
  const actionId = `${ctx.stash.typeName}.${ctx.stash.fieldName}`;

  const user = buildUser(userId, members);
  const entity = ctx.prev.result as File | Folder | Project;
  const entitiesDefinition = buildEntityList(entity);

  const resource = buildResource(entity);
  const requestBody = {
    action: {
      actionId: actionId,
      actionType: `${NAMESPACE}::Action`,
    },
    context: {},
    entities: { entityList: [user, ...entitiesDefinition.entityList] },
    policyStoreId: policyStoreId,
    principal: user.identifier,
    resource: resource,
  };

  return requestBody;
}

function buildUser(userId: string, userAttributes: Member[]): EntityItem {
  const toEntityIdentifiers = (attr: Member): EntityIdentifier[] => {
    const type = attr.roleAndModel.endsWith("Projects")
      ? "Project"
      : attr.roleAndModel.endsWith("Folders")
        ? "Folder"
        : null;
    return attr.ids.map((id) => ({
      entityId: id,
      entityType: `${NAMESPACE}::${type}`,
    }));
  };
  const toAttributeValue = (
    entityIdentifier: EntityIdentifier
  ): AttributeValue => {
    return {
      entityIdentifier: entityIdentifier,
    };
  };

  const attributeNames = [
    "ownerProjects",
    "contributorProjects",
    "viewerProjects",
    "ownerFolders",
    "contributorFolders",
    "viewerFolders",
  ];

  const attributes = attributeNames.reduce(
    (seen, attrName) => {
      seen[attrName] = {
        set: userAttributes
          .filter((attr) => attr.roleAndModel === attrName)
          .map(toEntityIdentifiers)
          .flat()
          .map(toAttributeValue),
      };
      return seen;
    },
    {} as Record<string, AttributeValue>
  );

  return {
    identifier: {
      entityId: userId,
      entityType: `${NAMESPACE}::User`,
    },
    attributes,
  };
}

function buildResource(entity: File | Folder | Project): EntityIdentifier {
  return {
    entityId: entity.id,
    entityType: `${NAMESPACE}::${entity.__typename}`,
  };
}

function buildEntityList(entity: File | Folder | Project): EntitiesDefinition {
  const entityList: EntityItem[] = [];
  if (entity.__typename === "File") {
    const file = entity as File;
    const fileEntity: EntityItem = {
      identifier: {
        entityId: entity.id,
        entityType: `${NAMESPACE}::File`,
      },
    };
    entityList.push(fileEntity);
    let folderEntity: EntityItem | undefined;
    if (file.folderId) {
      folderEntity = {
        identifier: {
          entityId: file.folderId!,
          entityType: `${NAMESPACE}::Folder`,
        },
      };
      entityList.push(folderEntity);
      fileEntity.parents = fileEntity.parents ?? [];
      fileEntity.parents.push({
        entityId: file.folderId,
        entityType: `${NAMESPACE}::Folder`,
      });
    }
    if (file.projectId) {
      entityList.push({
        identifier: {
          entityId: file.projectId!,
          entityType: `${NAMESPACE}::Project`,
        },
      });
      if (folderEntity) {
        folderEntity.parents = folderEntity.parents ?? [];
        folderEntity.parents.push({
          entityId: file.projectId,
          entityType: `${NAMESPACE}::Project`,
        });
      }
      fileEntity.parents = fileEntity.parents ?? [];
      fileEntity.parents.push({
        entityId: file.projectId,
        entityType: `${NAMESPACE}::Project`,
      });
    }
  } else if (entity.__typename === "Folder") {
    const folder = entity as Folder;
    const folderEntity: EntityItem = {
      identifier: {
        entityId: entity.id,
        entityType: `${NAMESPACE}::Folder`,
      },
    };
    entityList.push(folderEntity);
    if (folder.projectId) {
      entityList.push({
        identifier: {
          entityId: folder.projectId,
          entityType: `${NAMESPACE}::Project`,
        },
      });
      folderEntity.parents = folderEntity.parents ?? [];
      folderEntity.parents.push({
        entityId: folder.projectId,
        entityType: `${NAMESPACE}::Project`,
      });
    }
  } else if (entity.__typename === "Project") {
    entityList.push({
      identifier: {
        entityId: entity.id,
        entityType: `${NAMESPACE}::Project`,
      },
    });
  }
  // console.log(`Entity List: ${JSON.stringify(entityList, null, 2)}`);
  return {
    entityList,
  };
}
