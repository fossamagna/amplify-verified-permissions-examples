# Amazon Verified Permissions (AVP) と AppSync (Amplify Gen2) 統合サンプル

このリポジトリは、Amazon Verified Permissions (AVP) を AWS Amplify Gen2 の AppSync API と統合するサンプル実装を提供します。これにより、きめ細やかなアクセス制御をアプリケーションに組み込む方法を示します。

## フォルダ構成

主要なフォルダとファイルは以下の通りです。

- `amplify/`: Amplify Gen2 バックエンドの定義が含まれます。
  - `auth/`: 認証リソースの定義。
  - `authz/`: Amazon Verified Permissions (AVP) との統合に関するロジックが含まれます。
    - `authz.ts`: AVP Policy Store、AppSyncデータソース、IAMロール、リゾルバへの認可処理の追加など、AVP統合の主要な設定が含まれます。
    - `policy-store.ts`: AVP Policy Storeの作成と、Cedarポリシー（`owner.cedar`, `contributor.cedar`, `viewer.cedar`）の登録を行います。
    - `verified-permissions-schema.json`: AVPで使用されるスキーマ定義。
    - `functions/`: AppSyncリゾルバに認可ロジックを追加するためのAppSync関数。
    - `policies/`: Cedarポリシーファイル（`owner.cedar`, `contributor.cedar`, `viewer.cedar`）。
    - `resolvers/`: AppSyncリゾルバに関連する型定義。
    - `syncMember/`: `ProjectMember`および`FolderMember`の変更を同期するためのLambda関数。
  - `data/`: AppSyncのデータモデル定義（GraphQLスキーマ）。
    - `resource.ts`: `Project`, `Folder`, `File`, `ProjectMember`, `FolderMember`, `MemberRole`などのデータモデルが定義されています。
  - `seed/`: 初期データを投入するためのスクリプト。
- `src/`: フロントエンドのReactアプリケーションのソースコード。

## データモデル

このサンプルアプリケーションでは、以下のデータモデルを使用しています。

- **Project**: プロジェクトを表します。
  - `id`: プロジェクトID
  - `name`: プロジェクト名
  - `description`: プロジェクトの説明
  - `folders`: 関連するフォルダ
  - `files`: 関連するファイル
  - `members`: 関連するプロジェクトメンバー
- **Folder**: プロジェクト内のフォルダを表します。
  - `id`: フォルダID
  - `name`: フォルダ名
  - `projectId`: 所属するプロジェクトのID
  - `project`: 所属するプロジェクト
  - `files`: 関連するファイル
  - `members`: 関連するフォルダメンバー
- **File**: フォルダ内のファイルを表します。
  - `id`: ファイルID
  - `name`: ファイル名
  - `content`: ファイルの内容
  - `folderId`: 所属するフォルダのID
  - `folder`: 所属するフォルダ
  - `projectId`: 所属するプロジェクトのID
  - `project`: 所属するプロジェクト
- **ProjectMember**: プロジェクトとユーザーの関連付けを表します。
  - `userId`: ユーザーID
  - `projectId`: プロジェクトID
  - `role`: メンバーの役割 (`OWNER`, `CONTRIBUTOR`, `VIEWER`)
- **FolderMember**: フォルダとユーザーの関連付けを表します。
  - `userId`: ユーザーID
  - `folderId`: フォルダID
  - `role`: メンバーの役割 (`OWNER`, `CONTRIBUTOR`, `VIEWER`)
- **MemberRole**: メンバーの役割を定義するEnum。
  - `OWNER`: 所有者
  - `CONTRIBUTOR`: 貢献者（書き込み権限あり、削除権限なし）
  - `VIEWER`: 閲覧者（読み取り専用）

## AVP の AppSync への統合

このリポジトリでは、Amazon Verified Permissions を使用して AppSync API のきめ細やかなアクセス制御を実装しています。

1.  **Policy Store の作成**: `amplify/authz/policy-store.ts` で AVP Policy Store が作成されます。このストアには、アプリケーションの認証スキーマ (`verified-permissions-schema.json`) と、`owner.cedar`, `contributor.cedar`, `viewer.cedar` といったCedarポリシーが登録されます。
2.  **AppSync データソースの設定**: AppSync API は、AVP サービスエンドポイントを指す HTTP データソース (`VerifiedPermissionsDS`) を使用して AVP と通信します。これにより、AppSyncリゾルバから直接 AVP の `IsAuthorized` および `BatchIsAuthorized` API を呼び出すことが可能になります。
3.  **IAM ロールの付与**: AppSync が AVP を呼び出すための適切な権限を持つ IAM ロール (`VerifiedPermissionsRole`) が作成され、AppSync サービスプリンシパルに付与されます。
4.  **リゾルバへの認証ロジックの追加**: `amplify/authz/authz.ts` 内の `addAuthFunctionsToResolvers` 関数により、各 AppSync リゾルバに認証ロジックが動的に追加されます。これにより、データアクセス要求が AVP に送信され、定義されたポリシーに基づいてアクセスが許可されるかどうかが判断されます。
5.  **メンバー情報の同期**: `ProjectMember` および `FolderMember` モデルの変更は、DynamoDB ストリームを介して `amplify/authz/syncMember/handler.ts` で定義された Lambda 関数 (`MemberFunction`) によって捕捉され、AVP が利用できる形式で `MemberTable` に同期されます。これにより、AVPポリシーが最新のメンバー情報に基づいて評価されるようになります。

## 実行方法

このサンプルアプリケーションを実行するには、以下の手順に従います。

1.  **依存関係のインストール**:
    ```bash
    npm install
    ```
2.  **Amplify バックエンドのデプロイ**:
    ```bash
    npx amplify sandbox
    ```
    これにより、AWSアカウントにAmplifyバックエンドがデプロイされ、AppSync API、DynamoDBテーブル、Lambda関数、AVP Policy Storeなどがプロビジョニングされます。
3.  **初期データの投入 (オプション)**:
    ```bash
    npm run seed
    ```
    このコマンドは、`amplify/seed.ts`スクリプトを実行し、サンプルデータ（プロジェクト、フォルダ、ファイル、メンバー）をデータベースに投入します。
4.  **フロントエンドアプリケーションの起動**:
    ```bash
    npm run dev
    ```
    これにより、開発サーバーが起動し、ブラウザでアプリケーションにアクセスできるようになります。
