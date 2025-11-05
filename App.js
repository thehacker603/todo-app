import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function App() {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [menuIndex, setMenuIndex] = useState(null); // task aperta per cambiare priorità

  useEffect(() => { loadTasks(); }, []);
  useEffect(() => { saveTasks(); }, [tasks]);

  const saveTasks = async () => {
    try { await AsyncStorage.setItem("tasks", JSON.stringify(tasks)); }
    catch (error) { console.log("Errore salvataggio:", error); }
  };

  const loadTasks = async () => {
    try {
      const storedTasks = await AsyncStorage.getItem("tasks");
      if (storedTasks) setTasks(JSON.parse(storedTasks));
    } catch (error) {
      console.log("Errore caricamento:", error);
    }
  };

  const addTask = () => {
    if (task.trim() === "") return;
    setTasks([...tasks, { text: task, done: false, priority: "low" }]);
    setTask("");
  };

  const toggleTask = (index) => {
    const newTasks = [...tasks];
    newTasks[index].done = !newTasks[index].done;
    setTasks(newTasks);
  };

  const deleteTask = (index) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    setTasks(newTasks);
  };

  const setPriority = (index, priority) => {
    const newTasks = [...tasks];
    newTasks[index].priority = priority;
    setTasks(newTasks);
    setMenuIndex(null); // chiudi menu
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case "high": return styles.high;
      case "medium": return styles.medium;
      default: return styles.low;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>To-Do List</Text>

      <TextInput
        style={styles.input}
        placeholder="Aggiungi un'attività..."
        value={task}
        onChangeText={setTask}
      />

      <TouchableOpacity style={styles.addButton} onPress={addTask}>
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>

      <FlatList
        data={tasks}
        renderItem={({ item, index }) => (
          <View>
            <View style={styles.taskRow}>
              <TouchableOpacity
                onPress={() => toggleTask(index)}
                style={[styles.task, getPriorityStyle(item.priority), item.done && styles.done]}
              >
                <Text>{item.text}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuIndex(menuIndex === index ? null : index)}
              >
                <Text style={{ fontSize: 18 }}>⋮</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => deleteTask(index)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>X</Text>
              </TouchableOpacity>
            </View>

            {menuIndex === index && (
              <View style={styles.priorityMenu}>
                <TouchableOpacity onPress={() => setPriority(index, "low")}><Text>Bassa</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPriority(index, "medium")}><Text>Media</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPriority(index, "high")}><Text>Alta</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
        keyExtractor={(item, index) => index.toString()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f2f2f2" },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#aaa", padding: 10, borderRadius: 8, backgroundColor: "#fff" },
  addButton: { backgroundColor: "#007bff", padding: 12, borderRadius: 8, marginBottom: 15 },
  addButtonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  
  taskRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  task: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  done: { textDecorationLine: "line-through", opacity: 0.6 },
  
  menuButton: { marginLeft: 8, padding: 8 },
  deleteButton: { marginLeft: 6, backgroundColor: "#ff4d4d", padding: 8, borderRadius: 6 },
  deleteText: { color: "#fff", fontWeight: "bold" },

  /** SFONDI PRIORITÀ */
  low: { backgroundColor: "#b7f8a1" },      // verde chiaro
  medium: { backgroundColor: "#ffe9a3" },   // giallo chiaro
  high: { backgroundColor: "#ffb3b3" },     // rosso chiaro

  /** MENU PRIORITÀ */
  priorityMenu: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 8,
    marginLeft: 5,
    width: 150
  },
});
