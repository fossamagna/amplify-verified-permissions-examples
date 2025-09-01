import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";
import FileList from "./components/FileList";
import { AppBar, Toolbar, Typography, Button } from "@mui/material";

function App() {
  return (
    <Authenticator>
      {({ signOut }) => (
        <div className="App">
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                File Storage
              </Typography>
              <Button color="inherit" onClick={signOut}>
                Sign out
              </Button>
            </Toolbar>
          </AppBar>
          <FileList />
        </div>
      )}
    </Authenticator>
  );
}

export default App;
