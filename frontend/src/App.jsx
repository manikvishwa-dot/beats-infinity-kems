import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import AppRoutes from "./routes/AppRoutes";

function App() {
    return (
        <BrowserRouter>

            <Toaster
                position="top-right"
                reverseOrder={false}
            />

            <AppRoutes />

        </BrowserRouter>
    );
}

export default App;