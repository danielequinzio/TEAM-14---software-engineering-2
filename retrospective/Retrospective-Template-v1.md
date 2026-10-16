TEMPLATE FOR RETROSPECTIVE (Team 14)
=====================================

The retrospective should include _at least_ the following
sections:

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done : 2 committed vs 1 done
- Total points committed vs done : 5 points vs 2 done
- Nr of hours planned vs spent (as a team) : 34h 30m vs 41h 25m

**Remember**  a story is done ONLY if it fits the Definition of Done:
 
- Unit Tests passing
- Code review completed
- Code present on Git
- End-to-End tests performed

> Please refine your DoD 

### Detailed statistics

| Story  | # Tasks | Points | Hours est. | Hours actual |
|--------|---------|--------|------------|--------------|
| _#0_   |   8      |    -   |      20h      |      20h 50m     |
| 1    |   4      |     2   |      7h      |       8h 15m       |
| 5  (not completed)  |   4      |     3  |       9h 30m     |   12h 20m           |
   

> place technical tasks corresponding to story `#0` and leave out story points (not applicable in this case)

- Hours per task average, standard deviation (estimate and actual)

|            | Mean | StDev |
|------------|------|-------|
| Estimation |  2h 17m    |   2h 08m    | 
| Actual     |  2h 35m  |  2h 31m     |

- Total estimation error ratio: sum of total hours spent / sum of total hours effort - 1

    $$\frac{\sum_i spent_{task_i}}{\sum_i estimation_{task_i}} - 1 = 0.1347 \quad (13.47\%)$$
    
- Absolute relative task estimation error: sum( abs( spent-task-i / estimation-task-i - 1))/n

    $$\frac{1}{n}\sum_i^n \left| \frac{\text{spent}_{\text{task}_i}}{\text{estimation}_{\text{task}_i}}-1 \right| = 0.2731 \quad (27.31\%)$$

  
## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated
  - Total hours spent
  - Nr of automated unit test cases 
  - Coverage
- E2E testing:
  - Total hours estimated
  - Total hours spent
  - Nr of test cases
- Code review 
  - Total hours estimated 
  - Total hours spent  


## ASSESSMENT

- What caused your errors in estimation (if any)? we considered also the time for each story during planning, some tasks like testing were longer than expected.

- What lessons did you learn (both positive and negative) in this sprint? a good lesson: it's good dividing task between all memebers so everyone can work and there aren't people that working to the same parts.
Negative aspect: the tasks that we defined, they were too general for this sprint, we didn't specify clearly how to do tasks during our meeting, we didn't organise well our scrum planning

- Which improvement goals set in the previous retrospective were you able to achieve? 
  -
- Which ones you were not able to achieve? Why?
  -
- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)
team coordination: we should improve planning on how assigning tasks to every members so everyone can work 8h per week, we should improve to be more clear in our meeting on how to do tasks, how assigning tasks and we should specify better what we are going to do in the tasks (for instance in this sprint: backend dev is too general).

- One thing you are proud of as a Team!! 
  As first sprint, everyone did a good job because everyone worked and everyone did more or less the tasks assigned during planning