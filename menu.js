import { headerCreate } from "./header.js";

// Create menu
const menu = document.createElement("div");

// Style
menu.style.width = "350px";
menu.style.height = "400px";

menu.style.position = "fixed";
menu.style.top = "100px";
menu.style.right = "20px";

menu.style.backgroundColor = "white";
menu.style.border = "2px solid black";

menu.textContent = "Tribos Menu";

// Add to document body
document.body.appendChild(menu);
