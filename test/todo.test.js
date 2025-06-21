test('Project to-do list should be marked as done', () => {
  // List of tasks to complete for this project
  const toDoList = [
    "One by one, Consolidate HC discovery tasks into the new hc-helpers module and consolidate its test"
  ];

  // Pass the test if the toDoList is empty
  expect(toDoList).toEqual([]);
});
