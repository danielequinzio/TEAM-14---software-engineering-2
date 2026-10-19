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

    $$\frac{\sum_i spent_{task_i}}{\sum_i estimation_{task_i}} - 1 = 0.1347 \quad (13.47 \% )$$
    
- Absolute relative task estimation error: sum( abs( spent-task-i / estimation-task-i - 1))/n

     $$\frac{1}{n}\sum_i^n \left\lvert \frac{spent_{task_i}}{estimation_{task_i}} - 1 \right\rvert = 0.2731 \quad (27.31 \% )$$


  
## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated: 6 hours
  - Total hours spent: 9 hours 20 min
  - Nr of automated unit test cases: 39 tests 
  - Coverage: 88%
- E2E testing:
  - Total hours estimated: 6 hours
  - Total hours spent: 9 hours 20 min
  - Nr of test cases: 20 tests

We didn't do a separation between unit and e2e testing during planning, so our estimation and time spent comprehend both.

- Code review 
  - Total hours estimated: Not defined
  - Total hours spent: Not defined  

We reviewed our code before marking tasks as 'done' but we didn't define a specific task so time was not estimated or tracked.


## ASSESSMENT

- What caused your errors in estimation (if any)?  
We considered also the time for each story during planning, some tasks like testing were longer than expected.

- What lessons did you learn (both positive and negative) in this sprint?  
A good lesson: it's good dividing task between all memebers so everyone can work and there aren't too many people working to the same parts.  
Negative aspect: the tasks that we defined were too general for this sprint, we didn't specify clearly how to do tasks during our meeting, we didn't organise well our scrum planning.

- Which improvement goals set in the previous retrospective were you able to achieve? 
  -
- Which ones you were not able to achieve? Why?
  -
- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)  
Team coordination: we should improve our task assignation so everyone can work ~8h per week, we should improve to be more clear in our meetings on how to do tasks.  
Technical tasks: We should define more specific tasks (for instance 'Backend Dev' is too general), we should also define code review tasks.

- One thing you are proud of as a Team!!  
As the first sprint, we did a good job as a team because everyone worked and did more or less the tasks assigned during planning.
