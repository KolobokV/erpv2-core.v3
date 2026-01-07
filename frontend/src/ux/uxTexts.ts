export const UX = {
  locations: {
    tasks: "Tasks for accountant",
  },

  emptyStates: {
    noClients: {
      title: "No clients yet",
      description:
        "Clients are not created yet. Until a client exists, tasks cannot be generated.",
      action: "Create first client",
    },

    noTasks: {
      title: "No tasks yet",
      description:
        "Tasks will appear automatically after client setup or automation run.",
    },
  },

  taskStatuses: {
    not_started: "Not started",
    in_progress: "In progress",
    completed: "Completed",
    postponed: "Postponed",
  },

  actions: {
    materializeTasks:
      "Generate accountant tasks automatically",
  },

  hints: {
    materializeTasks:
      "Creates tasks based on client data. No effect if clients are missing.",
  },
};