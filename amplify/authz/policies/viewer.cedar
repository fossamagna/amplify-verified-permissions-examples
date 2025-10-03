permit (
  principal,
  action in [
    AmplifyAVP::Action::"Query.getProject",
    AmplifyAVP::Action::"Query.getFolder",
    AmplifyAVP::Action::"Query.getFile",
    AmplifyAVP::Action::"Query.listFolders",
    AmplifyAVP::Action::"Query.listFiles",
    AmplifyAVP::Action::"Query.listProjectMembers",
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
  resource in principal.viewerProjects || resource in principal.viewerFolders
};
