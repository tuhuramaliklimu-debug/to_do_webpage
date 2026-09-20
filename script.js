/* ============================================================
   TASKLY — To-Do App
   Vanilla JavaScript, no frameworks
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     DOM ELEMENTS
     ---------------------------------------------------------- */
  const taskInput       = document.getElementById('taskInput');
  const addTaskBtn      = document.getElementById('addTaskBtn');
  const taskList        = document.getElementById('taskList');
  const modalTaskList   = document.getElementById('modalTaskList');
  const emptyState      = document.getElementById('emptyState');
  const statTotal       = document.getElementById('statTotal');
  const statPending     = document.getElementById('statPending');
  const statCompleted   = document.getElementById('statCompleted');
  const searchInput     = document.getElementById('searchInput');
  const filterButtons   = document.querySelectorAll('.filter');
  const viewAllBtn      = document.getElementById('viewAllBtn');
  const hiddenCount     = document.getElementById('hiddenCount');
  const modal           = document.getElementById('modal');
  const modalBackdrop   = document.getElementById('modalBackdrop');
  const modalClose      = document.getElementById('modalClose');
  const toast           = document.getElementById('toast');
  const themeToggle     = document.getElementById('themeToggle');
  const themeIcon       = document.getElementById('themeIcon');
  const getStartedBtn   = document.getElementById('getStartedBtn');

  /* ----------------------------------------------------------
     STATE
     ---------------------------------------------------------- */
  const STORAGE_KEY = 'taskly-tasks-v3';
  const THEME_KEY   = 'taskly-theme';
  const VISIBLE_LIMIT = 4;          // max tasks shown on main screen

  let tasks = [];                   // array of { id, title, completed }
  let currentFilter = 'all';        // 'all' | 'pending' | 'completed'
  let currentSearch = '';
  let editingId = null;             // id of task being edited
  let toastTimer = null;

  /* ----------------------------------------------------------
     UTILITIES
     ---------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ----------------------------------------------------------
     TOAST NOTIFICATION
     ---------------------------------------------------------- */
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  /* ----------------------------------------------------------
     LOCAL STORAGE
     ---------------------------------------------------------- */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      /* ignore storage errors */
    }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tasks = parsed.filter(t => t && typeof t.title === 'string');
          return;
        }
      }
    } catch (e) {
      /* ignore */
    }
    // Seed with a few example tasks on first visit
    tasks = [
      { id: uid(), title: 'Design landing page',  completed: false },
      { id: uid(), title: 'Review pull requests', completed: false },
      { id: uid(), title: 'Update documentation', completed: true  },
      { id: uid(), title: 'Plan sprint meeting',  completed: false }
    ];
    saveTasks();
  }

  /* ----------------------------------------------------------
     STATS
     ---------------------------------------------------------- */
  function updateStats() {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending   = total - completed;

    statTotal.textContent     = total;
    statPending.textContent   = pending;
    statCompleted.textContent = completed;
  }

  /* ----------------------------------------------------------
     FILTERING
     ---------------------------------------------------------- */
  function getFilteredTasks() {
    return tasks.filter(task => {
      // Filter by status
      if (currentFilter === 'pending'   && task.completed)  return false;
      if (currentFilter === 'completed' && !task.completed) return false;

      // Filter by search
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        if (!task.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  /* ----------------------------------------------------------
     RENDER TASK ITEM (shared between main list and modal)
     ---------------------------------------------------------- */
  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.dataset.id = task.id;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task__checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', 'Toggle task completion');
    checkbox.addEventListener('change', () => toggleTask(task.id));

    // Title
    const title = document.createElement('span');
    title.className = 'task__title';
    title.textContent = task.title;

    // Actions container
    const actions = document.createElement('div');
    actions.className = 'task__actions';

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'task__btn';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    editBtn.addEventListener('click', () => startEditTask(task.id));

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task__btn task__btn--delete';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(title);
    li.appendChild(actions);

    return li;
  }

  /* ----------------------------------------------------------
     RENDER MAIN LIST
     ---------------------------------------------------------- */
  function render() {
    const filtered = getFilteredTasks();

    // Clear lists
    taskList.innerHTML = '';
    modalTaskList.innerHTML = '';

    // Empty state
    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      taskList.style.display = 'none';
      viewAllBtn.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      taskList.style.display = 'flex';

      // Show only the most recent VISIBLE_LIMIT tasks on main screen
      const visibleTasks = filtered.slice(0, VISIBLE_LIMIT);
      const remaining = filtered.length - visibleTasks.length;

      visibleTasks.forEach(task => {
        taskList.appendChild(createTaskElement(task));
      });

      // View-all button
      if (remaining > 0) {
        viewAllBtn.classList.remove('hidden');
        hiddenCount.textContent = remaining;
      } else {
        viewAllBtn.classList.add('hidden');
      }
    }

    // Populate modal list (all filtered tasks)
    filtered.forEach(task => {
      modalTaskList.appendChild(createTaskElement(task));
    });

    updateStats();
  }

  /* ----------------------------------------------------------
     ADD TASK
     ---------------------------------------------------------- */
  function addTask() {
    const title = taskInput.value.trim();

    // Prevent empty tasks
    if (!title) {
      taskInput.focus();
      taskInput.style.borderColor = 'var(--red)';
      taskInput.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
      setTimeout(() => {
        taskInput.style.borderColor = '';
        taskInput.style.boxShadow = '';
      }, 1200);
      showToast('Please enter a task');
      return;
    }

    tasks.unshift({
      id: uid(),
      title: title,
      completed: false
    });

    saveTasks();
    render();
    taskInput.value = '';
    taskInput.focus();
    showToast('Task added');
  }

  /* ----------------------------------------------------------
     TOGGLE COMPLETION
     ---------------------------------------------------------- */
  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    render();
    showToast(task.completed ? 'Task completed' : 'Task reopened');
  }

  /* ----------------------------------------------------------
     DELETE TASK
     ---------------------------------------------------------- */
  function deleteTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    tasks.splice(index, 1);
    saveTasks();
    render();
    showToast('Task deleted');
  }

  /* ----------------------------------------------------------
     EDIT TASK
     ---------------------------------------------------------- */
  function startEditTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Pre-fill input with current title
    taskInput.value = task.title;
    taskInput.focus();
    taskInput.select();
    editingId = id;

    // Change Add button into Save button temporarily
    addTaskBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    addTaskBtn.style.background = 'var(--green)';

    showToast('Editing task — press Enter or ✓ to save');
  }

  function saveEdit() {
    const newTitle = taskInput.value.trim();
    if (!newTitle) {
      showToast('Task cannot be empty');
      return;
    }

    const task = tasks.find(t => t.id === editingId);
    if (task) {
      task.title = newTitle;
      saveTasks();
      render();
      showToast('Task updated');
    }

    cancelEdit();
  }

  function cancelEdit() {
    editingId = null;
    taskInput.value = '';
    addTaskBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    addTaskBtn.style.background = '';
    taskInput.style.borderColor = '';
    taskInput.style.boxShadow = '';
  }

  /* ----------------------------------------------------------
     EVENT LISTENERS
     ---------------------------------------------------------- */

  // Add / Save task
  addTaskBtn.addEventListener('click', () => {
    if (editingId) saveEdit();
    else addTask();
  });

  // Enter key in input
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingId) saveEdit();
      else addTask();
    }
    if (e.key === 'Escape' && editingId) cancelEdit();
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    render();
  });

  // Filters
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('filter--active'));
      btn.classList.add('filter--active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // View all (open modal)
  viewAllBtn.addEventListener('click', () => {
    modal.classList.add('open');
  });

  // Modal close
  modalClose.addEventListener('click', () => modal.classList.remove('open'));
  modalBackdrop.addEventListener('click', () => modal.classList.remove('open'));

  // Escape closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      modal.classList.remove('open');
    }
  });

  // Get Started button focuses input
  getStartedBtn.addEventListener('click', () => {
    taskInput.focus();
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (e) { /* ignore */ }
  });

  // Load theme
  (function initTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark') {
        document.body.classList.add('dark');
        themeIcon.textContent = '☀️';
      }
    } catch (e) { /* ignore */ }
  })();

  /* ----------------------------------------------------------
     INIT
     ---------------------------------------------------------- */
  loadTasks();
  render();

})();