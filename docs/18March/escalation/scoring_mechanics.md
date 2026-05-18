### 1. Manager Responsiveness Score

This metric evaluates how quickly a manager reviews and action-approves their direct report's goal sheet after submission.

*   **Turnaround Measurement:** For all `approved` or `locked` goal sheets, the system computes the exact duration (in hours) between the employee's submission timestamp and the manager's approval timestamp:
    $$\text{Turnaround Hours} = \frac{\text{approved\_at} - \text{submitted\_at}}{\text{3600 seconds}}$$
*   **Average Score Formula:** The system averages these hours per manager and maps the average to a score index:
    *   **$\le$ 24 Hours:** **`100 pts`** (Outstanding SLA Turnaround)
    *   **$\le$ 72 Hours (3 Days):** **`90 pts`** (Standard SLA Compliance)
    *   **$\le$ 168 Hours (7 Days):** **`75 pts`** (Delayed Response)
    *   **$\le$ 336 Hours (14 Days):** **`50 pts`** (SLA Bottleneck)
    *   **Otherwise (> 14 Days):** **`30 pts`** (Severely Disengaged)

---

### 2. Employee Compliance Index

This index measures the employee's process discipline combined with their operational progress score.

*   **Calculation Formula:**
    $$\text{Compliance Index} = \frac{\text{Submission Compliance} + \text{Quarterly Progress Score}}{2}$$
*   **Where:**
    1.  **Submission Compliance:** Evaluates process compliance. If the employee has submitted their goal sheet for review (status is `submitted`, `approved`, or `locked`), they receive **`100.0%`**. If the sheet remains stuck in a `draft` or `rework` phase (or is completely uncreated), they receive **`0.0%`**.
    2.  **Quarterly Progress Score:** Evaluates operational execution. The system sums the weightage-adjusted achievements across all goals on their sheet:
        $$\text{Progress Score} = \sum \left( \text{Goal Completion Rate} \times \frac{\text{Goal Weightage}}{100.0} \right)$$

---

### 3. Composite Risk Score (Bonus Column in Matrix)

To compile the **Composite Risk Score (0-100%)** shown on the right of your dashboard, the engine evaluates process bottleneck weightings:

| Operational Breach Condition | Risk Score Weight Impact | Description |
| :--- | :--- | :--- |
| **Active SLA Breach** | `+30 points` | System currently running an active escalation workflow warning for the employee. |
| **Stalled Low Completion** | `+20 points` | Employee's overall goal progress is currently $< 50.0\%$. |
| **Draft Overdue Stalled** | `+20 points` | Goal setting window is open but sheet is still unsubmitted. |
| **Missing Manager Check-in** | `+15 points` | Submitted sheet lacks a quarterly direct manager review check-in comment. |
| **Disengaged Manager** | `+15 points` | Direct manager responsiveness score is under `70` points. |