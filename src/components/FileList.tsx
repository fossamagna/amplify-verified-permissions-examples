import React, { useState, useEffect } from 'react';
import { List, ListItem, ListItemIcon, ListItemText, Paper, Typography } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { client } from '../amplify';
import type { Schema } from '../../amplify/data/resource';

const FileList: React.FC = () => {
  const [files, setFiles] = useState<Array<Schema["File"]["type"]>>([]);

  useEffect(() => {
    const sub = client.models.File.observeQuery().subscribe({
      next: (data) => setFiles([...data.items]),
    });

    return () => sub.unsubscribe();
  }, []);

  return (
    <Paper elevation={3} style={{ margin: '20px', padding: '20px' }}>
      <Typography variant="h5" gutterBottom>
        File List
      </Typography>
      <List>
        {files.map((file) => (
          <ListItem key={file.id}>
            <ListItemIcon>
              <InsertDriveFileIcon />
            </ListItemIcon>
            <ListItemText primary={file.name} secondary={file.content} />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default FileList;
