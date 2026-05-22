Fix Preferred List filtering logic.

IMPORTANT:
District filtering must happen BEFORE recommendation generation.

Current issue:
Even after selecting districts like:

* Hanmakonda
* Jagtial

the recommendation list still includes colleges from other districts.

REQUIRED FIX:

1. If user selects one or more districts:
   ONLY colleges from those districts should enter the recommendation engine.

2. Recommendation generation must run ONLY on the filtered district dataset.

3. Branch filtering should also happen BEFORE recommendation classification.

Correct flow:

selected districts
→ selected branches
→ category/gender filters
→ SAFE/MODERATE logic
→ final sorting

IMPORTANT:
Do NOT mix colleges from unselected districts.

EXPECTED BEHAVIOR:
If user selects:

* Hanmakonda
* Jagtial

then every generated recommendation must belong ONLY to:

* Hanmakonda
  OR
* Jagtial

UNLESS:
no districts are selected.

If no districts selected:
show all districts normally.

Preserve:

* SAFE/MODERATE classification
* dynamic preference generation
* existing responsive UI
* sorting logic
