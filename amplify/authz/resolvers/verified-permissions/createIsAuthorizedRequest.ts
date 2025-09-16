import type { AppSyncIdentityCognito, Context } from "@aws-appsync/utils";
import type { File, Folder, Project, ProjectMember } from "../types/index";
import type {
  EntityItem,
  EntityIdentifier,
  AttributeValue,
  EntitiesDefinition,
} from "./types";

const NAMESPACE = "AmplifyAVP";

export function createIsAuthorizedRequest(ctx: Context) {
  const identity = ctx.identity as AppSyncIdentityCognito;
  const userId = identity.claims.sub;
  const projectMembers = ctx.stash.userAttributes
    .projectMembers as ProjectMember[];
  const policyStoreId = ctx.stash.policyStoreId as string;
  const actionId = `${ctx.stash.typeName}.${ctx.stash.fieldName}`;

  const user = buildUser(userId, projectMembers);
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

function buildUser(
  userId: string,
  userAttributes: ProjectMember[]
): EntityItem {
  const toEntityIdentifier = (attr: ProjectMember): EntityIdentifier => {
    return {
      entityId: attr.projectId,
      entityType: `${NAMESPACE}::Project`,
    };
  };
  const toAttributeValue = (
    entityIdentifier: EntityIdentifier
  ): AttributeValue => {
    return {
      entityIdentifier: entityIdentifier,
    };
  };

  return {
    identifier: {
      entityId: userId,
      entityType: `${NAMESPACE}::User`,
    },
    attributes: {
      ownerProjects: {
        set: userAttributes
          .filter((attr) => attr.role === "OWNER")
          .map(toEntityIdentifier)
          .map(toAttributeValue),
      },
      contributorProjects: {
        set: userAttributes
          .filter((attr) => attr.role === "CONTRIBUTOR")
          .map(toEntityIdentifier)
          .map(toAttributeValue),
      },
      viewerProjects: {
        set: userAttributes
          .filter((attr) => attr.role === "VIEWER")
          .map(toEntityIdentifier)
          .map(toAttributeValue),
      },
    },
  };
}

function buildResource(entity: File | Folder | Project): EntityIdentifier {
  return {
    entityId: entity.id,
    entityType: Object.hasOwn(entity, "folderId")
      ? `${NAMESPACE}::File`
      : Object.hasOwn(entity, "projectId")
        ? `${NAMESPACE}::Folder`
        : `${NAMESPACE}::Project`,
  };
}

function buildEntityList(entity: File | Folder | Project): EntitiesDefinition {
  const entityList: EntityItem[] = [];
  if (entity.___typename === "File" && entity.folderId) {
    const file = entity as File;
    const fileEntity: EntityItem = {
      identifier: {
        entityId: entity.id,
        entityType: `${NAMESPACE}::File`,
      },
      attributes: {},
    };
    let folderEntity: EntityItem | undefined;
    if (file.folderId) {
      folderEntity = {
        identifier: {
          entityId: file.folderId!,
          entityType: `${NAMESPACE}::Folder`,
        },
        attributes: {},
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
        attributes: {},
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
  } else if (entity.___typename === "Folder" && entity.projectId) {
    const folder = entity as Folder;
    const folderEntity: EntityItem = {
      identifier: {
        entityId: entity.id,
        entityType: `${NAMESPACE}::Folder`,
      },
      attributes: {},
    };
    entityList.push(folderEntity);
    if (folder.projectId) {
      entityList.push({
        identifier: {
          entityId: folder.projectId,
          entityType: `${NAMESPACE}::Project`,
        },
        attributes: {},
      });
      folderEntity.parents = folderEntity.parents ?? [];
      folderEntity.parents.push({
        entityId: folder.projectId,
        entityType: `${NAMESPACE}::Project`,
      });
    }
  } else if (entity.___typename === "Project") {
    entityList.push({
      identifier: {
        entityId: entity.id,
        entityType: `${NAMESPACE}::Project`,
      },
      attributes: {},
    });
  }
  return {
    entityList,
  };
}
