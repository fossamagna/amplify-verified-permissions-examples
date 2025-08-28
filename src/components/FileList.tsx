import React, { useState, useEffect } from "react";
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { client } from "../amplify";
import type { Schema } from "../../amplify/data/resource";

type FileWithFolder = Pick<
  Schema["File"]["type"],
  "id" | "name" | "content"
> & { folder: Pick<Schema["Folder"]["type"], "name"> };

const FileList: React.FC = () => {
  const [files, setFiles] = useState<Array<FileWithFolder>>([]);

  useEffect(() => {
    const fetchFiles = async () => {
      const { data: items } = await client.models.File.list({
        selectionSet: ["id", "name", "content", "folder.name"],
      });
      setFiles(items);
    };

    fetchFiles();
  }, []);

  return (
    <Paper elevation={3} style={{ margin: "20px", padding: "20px" }}>
      <Typography variant="h5" gutterBottom>
        File List
      </Typography>
      <List>
        {files.map((file) => (
          <ListItem key={file.id}>
            <ListItemIcon>
              <InsertDriveFileIcon />
            </ListItemIcon>
            <ListItemText
              primary={file.name}
              secondary={
                file.folder.name
                  ? `Folder: ${file.folder.name} | ${file.content}`
                  : file.content
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default FileList;
