import "./NavBar.css";

import { useNavigate } from "react-router-dom";
import { Button } from "primereact/Button";
import { Divider } from "primereact/divider";

const NavBar = () => {
  const navigate = useNavigate();

  const onButtonClick = (path) => {
    navigate(path);
    navigate(0);
  };

  return (
    <div className="NavBar">
      <div className="NavBar__Buttons">
        <Button label="Partikelsimulation" onClick={() => onButtonClick("/particles")} />
        <Button label="Monte-Carlo PI" onClick={() => onButtonClick("/pi")} />
      </div>
      <Divider />
    </div>
  );
};
export default NavBar;
