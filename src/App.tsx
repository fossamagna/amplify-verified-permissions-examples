import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./App.css";
import FileList from "./components/FileList";

function App() {
  return (
    <Authenticator>
      {({ signOut }) => (
        <div className="App">
          <header>
            <button onClick={signOut}>Sign out</button>
          </header>
          <FileList />
        </div>
      )}
    </Authenticator>
  );
}

export default App;
