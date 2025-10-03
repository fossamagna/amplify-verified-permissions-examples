import { DynamoDBRecord, DynamoDBStreamHandler } from "aws-lambda";
import { Schema } from "../../data/resource";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

type ProjectMember = Pick<
  Schema["ProjectMember"]["type"],
  "userId" | "projectId" | "role"
> & { __typename: "ProjectMember" };

type FolderMember = Pick<
  Schema["FolderMember"]["type"],
  "userId" | "folderId" | "role"
> & { __typename: "FolderMember" };

type SourceType = ProjectMember | FolderMember;

type Member = {
  userId: string;
  roleAndModel: string;
  ids: string[];
};

export const handler: DynamoDBStreamHandler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  const failedEventIds = await syncMember(event.Records);
  return {
    batchItemFailures: failedEventIds.map((id) => ({ itemIdentifier: id })),
  }
};

async function syncMember(records: DynamoDBRecord[]) {
  const client = new DynamoDBClient({ region: process.env.AWS_REGION });
  const ddbDocClient = DynamoDBDocumentClient.from(client);
  const synchronizer = new MemberSynchronizer(
    ddbDocClient,
    process.env.MEMBER_TABLE_NAME!
  );
  await Promise.allSettled(records.map((record) => synchronizer.sync(record)));
  const failedEventIds = await synchronizer.flushCache();
  return failedEventIds;
}

class MemberSynchronizer {
  private ddbDocClient: DynamoDBDocumentClient;
  private tableName: string;
  private cachedMember: Map<string, Member>; // userId + roleAndModel -> Member
  private memberKeyToEventIds: Map<string, string[]>; // userId + roleAndModel -> DynamoDBRecord.eventID

  constructor(ddbDocClient: DynamoDBDocumentClient, tableName: string) {
    this.ddbDocClient = ddbDocClient;
    this.tableName = tableName;
    this.cachedMember = new Map<string, Member>();
    this.memberKeyToEventIds = new Map<string, string[]>();
  }

  private createRoleAndModel(
    role: string,
    model: "ProjectMember" | "FolderMember"
  ): string {
    const roleAndModel = `${role?.toLowerCase()}${model === "ProjectMember" ? "Projects" : "Folders"}`;
    return roleAndModel;
  }

  private getId(source: SourceType): string {
    if (source.__typename === "ProjectMember") {
      return source.projectId;
    } else if (source.__typename === "FolderMember") {
      return source.folderId;
    }
    throw new Error(`Unknown source type: ${source}`);
  }

  private markEventId(image: SourceType, eventId?: string) {
    if (!eventId) {
      return;
    }
    const { userId, role, __typename } = image;
    const roleAndModel = this.createRoleAndModel(role, __typename);
    const key = `${userId}#${roleAndModel}`;
    let eventIds = this.memberKeyToEventIds.get(key);
    if (!eventIds) {
      eventIds = [];
      this.memberKeyToEventIds.set(key, eventIds);
    }
    if (!eventIds.includes(eventId)) {
      eventIds.push(eventId);
    }
  }

  async sync(record: DynamoDBRecord) {
    const eventName = record.eventName;
    if (eventName === "INSERT") {
      const newImage = unmarshall(
        record.dynamodb?.NewImage as { [key: string]: AttributeValue }
      ) as SourceType;
      const { userId, role, __typename } = newImage;
      const roleAndModel = this.createRoleAndModel(role, __typename);
      const member = await this.getOrNewMember(userId, roleAndModel);
      member.ids.push(this.getId(newImage));
      this.markEventId(newImage, record.eventID);
    } else if (eventName === "MODIFY") {
      const newImage = unmarshall(
        record.dynamodb?.NewImage as { [key: string]: AttributeValue }
      ) as SourceType;
      const oldImage = unmarshall(
        record.dynamodb?.OldImage as { [key: string]: AttributeValue }
      ) as SourceType;
      if (newImage.role !== oldImage.role) {
        // role changed
        const oldRoleAndModel = this.createRoleAndModel(
          oldImage.role,
          oldImage.__typename
        );
        const oldMember = await this.getOrNewMember(
          oldImage.userId,
          oldRoleAndModel
        );
        oldMember.ids = oldMember.ids.filter(
          (id) => id !== this.getId(oldImage)
        );
        this.markEventId(oldImage, record.eventID);

        const newRoleAndModel = this.createRoleAndModel(
          newImage.role,
          newImage.__typename
        );
        const newMember = await this.getOrNewMember(
          newImage.userId,
          newRoleAndModel
        );
        newMember.ids.push(this.getId(newImage));
        this.markEventId(newImage, record.eventID);
      }
    } else if (eventName === "REMOVE") {
      const oldImage = unmarshall(
        record.dynamodb?.OldImage as { [key: string]: AttributeValue }
      ) as SourceType;
      const { userId, role, __typename } = oldImage;
      const roleAndModel = this.createRoleAndModel(role, __typename);
      const member = await this.getOrNewMember(userId, roleAndModel);
      member.ids = member.ids.filter((id) => id !== this.getId(oldImage));
      this.markEventId(oldImage, record.eventID);
    }
  }

  async flushCache(): Promise<string[]> {
    for (const [cacheKey, member] of Array.from(this.cachedMember.entries())) {
      try {
        await this.putMemberToTable(member);
        this.cachedMember.delete(cacheKey);
        this.memberKeyToEventIds.delete(cacheKey);
      } catch (error) {
        const eventIds = this.memberKeyToEventIds.get(cacheKey) ?? [];
        console.error(
          `Failed to put member to table for cacheKey: ${cacheKey}. The following event IDs were associated with this member and may need to be retried: ${eventIds.join(", ")}`,
          error
        );
      }
    }
    return Array.from(this.memberKeyToEventIds.values()).flat();
  }

  private async getOrNewMember(
    userId: string,
    roleAndModel: string
  ): Promise<Member> {
    const cacheKey = `${userId}#${roleAndModel}`;
    let member = this.cachedMember.get(cacheKey);
    if (!member) {
      member = await this.getMemberFromTable(userId, roleAndModel);
      if (!member) {
        member = { userId, roleAndModel, ids: [] };
      }
      this.cachedMember.set(cacheKey, member);
    }
    return member;
  }

  private async getMemberFromTable(
    userId: string,
    roleAndModel: string
  ): Promise<Member | undefined> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId, roleAndModel },
      })
    );
    return (result.Item as Member) ?? undefined;
  }

  private async putMemberToTable(member: Member) {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: member,
      })
    );
  }
}
