permit (
  principal,
  action in [
    AmplifyAVP::Action::"Query.getProject",
    AmplifyAVP::Action::"Mutation.updateProject",
    AmplifyAVP::Action::"Query.getFolder",
    AmplifyAVP::Action::"Mutation.updateFolder",
    AmplifyAVP::Action::"Query.getFile",
    AmplifyAVP::Action::"Mutation.updateFile",
    AmplifyAVP::Action::"Mutation.createFolder",
    AmplifyAVP::Action::"Mutation.createFile",
    AmplifyAVP::Action::"Mutation.createProjectMember",
    AmplifyAVP::Action::"Mutation.updateProjectMember",
    AmplifyAVP::Action::"Query.listProjects",
    AmplifyAVP::Action::"Query.listFolders",
    AmplifyAVP::Action::"Query.listFiles",
    AmplifyAVP::Action::"Query.listProjectMembers",
    AmplifyAVP::Action::"Project.folders",
    AmplifyAVP::Action::"Project.files",
    AmplifyAVP::Action::"Folder.files",
    AmplifyAVP::Action::"Folder.project",
    AmplifyAVP::Action::"File.folder",
    AmplifyAVP::Action::"File.project",
  ],
  resource
)
when {
  resource in principal.contributorProjects || resource in principal.contributorFolders
};
