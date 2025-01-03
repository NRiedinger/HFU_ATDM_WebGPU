import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import LandingPage from "./components/LandingPage/LandingPage.jsx";
import ParticleSimulationPage from "./components/ParticleSimulationPage/ParticleSimulationPage.jsx";
import MonteCarloSimulationPage from "./components/MonteCarloSimulationPage/MonteCarloSimulationPage.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "/particles",
        element: <ParticleSimulationPage />,
      },
      {
        path: "/pi",
        element: <MonteCarloSimulationPage />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")).render(<RouterProvider router={router} />);
