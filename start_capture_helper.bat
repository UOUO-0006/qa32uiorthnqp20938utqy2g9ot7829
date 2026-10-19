@echo off
cd /d "%~dp0"
py -3 capture_helper.py
if errorlevel 1 pause
