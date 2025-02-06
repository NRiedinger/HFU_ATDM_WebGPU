import "./ParticleSimulationPage.css";

import { ParticleSimulation } from "../../../../particleSimulation/src/particleSimulation.js";
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Divider } from "primereact/divider";
import { Dropdown } from "primereact/dropdown";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/Button";

const renderOptions = [{ value: "GPU" }, { value: "CPU" }];

const ParticleSimulationPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedRenderer, setSelectedRenderer] = useState("GPU");
  const [particleCount, setParticleCount] = useState(200);

  useEffect(() => {
    let renderer = searchParams.get("renderer") || selectedRenderer;
    setSelectedRenderer(renderer);

    const particles = searchParams.get("particles") || particleCount;
    setParticleCount(particles);

    console.log(renderer, particles);
    ParticleSimulation.getInstance().run(+particles, renderer === "GPU");
  }, []);

  const onRun = () => {
    const params = new URLSearchParams();
    params.set("renderer", selectedRenderer);
    params.set("particles", particleCount);

    setSearchParams(params);
    navigate(0);
  };

  return (
    <div className="ParticleSimulationPage">
      <div className="ParticleSimulationPage__Container">
        <div className="ParticleSimulationPage__Container__UI">
          <FloatLabel>
            <Dropdown
              id="renderer-dropdown"
              value={selectedRenderer}
              onChange={(e) => setSelectedRenderer(e.value)}
              options={renderOptions}
              optionLabel="value"
              optionValue="value"
            />
            <label htmlFor="renderer-dropdown">Renderer</label>
          </FloatLabel>
          <FloatLabel>
            <InputNumber
              inputId="particlecount-input"
              min={1}
              value={particleCount}
              onValueChange={(e) => setParticleCount(e.value)}
            />
            <label htmlFor="particlecount-input">Anzahl Partikel</label>
          </FloatLabel>

          <Button label="Los" onClick={() => onRun()} />

          <Divider />

          <div className="ui-container">
            <div className="ui-row-title">Parameters</div>
            <div id="ui-parameters-container"></div>
            <div className="ui-row-title">Timings</div>
            <div id="ui-performance-container"></div>
          </div>
        </div>
        <Divider layout="vertical" />
        <canvas id="canvas-particles" width="600" height="600" />
      </div>
    </div>
  );
};
export default ParticleSimulationPage;
