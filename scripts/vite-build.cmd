@echo off
setlocal

set "NODE_EXE=%npm_node_execpath%"
if not defined NODE_EXE set "NODE_EXE=node"

call "%NODE_EXE%" "%~dp0..\node_modules\vite\bin\vite.js" build

