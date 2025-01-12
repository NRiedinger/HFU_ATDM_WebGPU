import "./ParticleSimulationPage.css";

import { ParticleSimulation } from "../../../../particleSimulation/src/particleSimulation.js";
import { useEffect, useState } from "react";
import { Divider } from "primereact/divider";
import { Dropdown } from "primereact/dropdown";
import { FloatLabel } from "primereact/floatlabel";
import { InputNumber } from "primereact/inputnumber";

const renderOptions = [{ value: "GPU" }, { value: "CPU" }];

const ParticleSimulationPage = () => {
  const [selectedRenderer, setSelectedRenderer] = useState("GPU");
  const [particleCount, setParticleCount] = useState(200);

  useEffect(() => {
    ParticleSimulation.getInstance().run(particleCount, selectedRenderer === "GPU");
    /* new ParticleSimulation(particleCount, selectedRenderer === "GPU"); */
  }, [selectedRenderer, particleCount]);

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
        </div>
        <Divider layout="vertical" />
        <canvas id="canvas-particles" width="600" height="600" />
      </div>
    </div>
  );
};
export default ParticleSimulationPage;
