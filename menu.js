// ==UserScript==
// @name         TW Central Suite (Fixed)
// @namespace    https://github.com/micatchulo/Tribos_Menu
// @version      1.1.1
// @description  Menu central para Tribal Wars — versão corrigida
// @match        https://pt117.tribalwars.com.pt/game.php*
// @grant        none
// ==/UserScript==

(function(){
    //------------------------------
    // Imports
    //------------------------------
    import {criarHeader} from "./header.js"

    //------------------------------
    // Create Menu
    //------------------------------

    // create menu div and attribute id
    const menu = document.createElement("div")
    menu.id = "MenuTribos" // 

    // add menu to document body
    document.body.appendChild(menu)

    //------------------------------
    // Define Window
    //------------------------------

    // width and height (size)
    menu.style.width = "300px"
    menu.style.height = "500px"

    // fixed menu
    menu.style.position = "fixed"

    // top and right (pos)
    menu.style.top = "30px"
    menu.style.right = "30px"

    // color
    menu.style.backgroundColor = "white"

    // first index of page (priority view)
    menu.style.zIndex = "99999"
    })

