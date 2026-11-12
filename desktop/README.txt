PROTOK · Airport Ops Agentic OS (portable edition)
==================================================

Two agents run a simulated passenger terminal:
  - the simulation agent runs Monte Carlo forecasts of the security queues,
  - the logistics agent reads the live flight feed and proposes staff moves,
  - a gate in code checks 8 rules before any notification reaches the staff.

The Overview shows the security hall in 3D (scanner lanes, queues, staff
moves between zones), the parameters on the left and the results on the
right. Change the passenger day, the schedule, the Monte Carlo futures, the
horizon, the reserve limit or switch the agent off, then "Apply and rerun".

FULL GUIDE
  Open the app and click the "Guide" tab (Macedonian and English).

HOW TO START
  Windows:        double-click Protok.exe
                  (it opens Protok.html in its own window using Edge or Chrome)
  Any computer:   double-click Protok.html (Edge, Chrome, Firefox or Safari)

Nothing to install, no internet needed, no setup. Keep Protok.exe and
Protok.html in the same folder. The whole folder can live on a USB stick.

If Windows shows "Windows protected your PC" (this happens when the folder
was downloaded or unzipped from the internet), click "More info" and then
"Run anyway", or just open Protok.html directly.

YOUR OWN DATA (tab "Your data")
  1. Drop an Excel (.xlsx) or CSV file, paste rows copied from Excel, or
     load the example day. "Download template" gives a ready CSV.
     Columns: Time (HH:MM), Flight, To, Zone (A, B or C), Pax, and an
     optional Type (short, lowcost, long). English or Macedonian headers,
     any order. The data never leaves the computer.
  2. Check the rows: errors are marked red and skipped, warnings yellow.
     Every cell can be edited, rows added or deleted.
  3. "Analyse the day" runs the whole day twice (with the agents and on a
     roster planned the week before) and reports the peak hour per zone,
     lanes needed against roster and physical lanes, waits, passengers at
     risk, findings and every move the agent would make. "Download results"
     saves the numbers per 15 minutes as CSV. "Use in Overview" plays the
     day in the 3D view.

KEYBOARD AND MOUSE
  Space        play / pause
  Right arrow  next 15 minutes
  1 2 3        select zone A, B, C
  R            restart the day
  3D view      drag to rotate, scroll to zoom, double-click to reset

If the computer has no 3D graphics (WebGL), the 3D view is replaced by a
short note and every table and chart still works.

The 3D view uses three.js (MIT licence, see THREE-LICENSE.txt).

WHAT IS REAL
  Every flight, passenger and event is invented. This is a simulation and
  is not connected to any real airport. The forecast is a little
  overconfident: about 74% of real waits fall inside the P10-P90 band
  against a target of 80%. The Compare view measures this for you.
