import { useState } from "react";
import "../styles/Todo.css";

function TodoItem({ todo, onToggle, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

  function commitEdit() {
    if (draft.trim()) {
      onEdit(todo.id, draft);
    } else {
      setDraft(todo.text);
    }
    setIsEditing(false);
  }

  return (
    <li className="todo-item">
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
        aria-label={`Mark "${todo.text}" ${todo.done ? "incomplete" : "complete"}`}
      />

      {isEditing ? (
        <input
          type="text"
          className="todo-edit-input"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitEdit();
            if (event.key === "Escape") {
              setDraft(todo.text);
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <span
          className={`todo-text ${todo.done ? "done" : ""}`}
          onDoubleClick={() => setIsEditing(true)}
          title="Double-click to edit"
        >
          {todo.text}
        </span>
      )}

      <button
        type="button"
        className="todo-delete"
        aria-label={`Delete "${todo.text}"`}
        onClick={() => onDelete(todo.id)}
      >
        ×
      </button>
    </li>
  );
}

function TodoPanel({
  todos,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
  onClose,
  onPointerEnter,
  onPointerLeave,
  onFirstKeystroke,
  onTypingPause,
  style,
}) {
  const [draft, setDraft] = useState("");

  function handleDraftChange(event) {
    const next = event.target.value;
    if (!draft && next) onFirstKeystroke?.();
    setDraft(next);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onAdd(draft);
    setDraft("");
  }

  return (
    <div
      className="todo-panel"
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="todo-panel-header">
        <span>To-do</span>
        <button
          type="button"
          className="todo-close"
          aria-label="Close list"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <form className="todo-add-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={handleDraftChange}
          onBlur={onTypingPause}
          placeholder="Add a task..."
        />
        <button type="submit">Add</button>
      </form>

      <ul className="todo-list">
        {todos.length === 0 && (
          <li className="todo-empty">Nothing yet — add something!</li>
        )}
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

export default TodoPanel;
