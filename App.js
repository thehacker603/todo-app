import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function App() {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [menuIndex, setMenuIndex] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => { loadTasks(); }, []);
  useEffect(() => { saveTasks(); }, [tasks]);

  const saveTasks = async () => {
    try { await AsyncStorage.setItem("tasks", JSON.stringify(tasks)); }
    catch {}
  };

  const loadTasks = async () => {
    try {
      const storedTasks = await AsyncStorage.getItem("tasks");
      if (storedTasks) setTasks(JSON.parse(storedTasks));
    } catch {}
  };

  const addTask = () => {
    if (task.trim() === "") return;
    setTasks([...tasks, { text: task, done: false, priority: "low" }]);
    setTask("");
    setModalVisible(false); // chiude popup
  };

  const toggleTask = (i) => {
    const t = [...tasks];
    t[i].done = !t[i].done;
    setTasks(t);
  };

  const deleteTask = (i) => {
    setTasks(tasks.filter((_, x) => x !== i));
  };

  const setPriority = (i, p) => {
    const t = [...tasks];
    t[i].priority = p;
    setTasks(t);
    setMenuIndex(null);
  };

  const priorityColor = {
    low: "#78e08f",
    medium: "#f6b93b",
    high: "#e55039"
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Tasks</Text>

      <FlatList
        data={tasks}
        renderItem={({ item, index }) => (
          <View style={styles.cardWrapper}>
            <TouchableOpacity
              onPress={() => toggleTask(index)}
              style={[
                styles.card,
                { borderLeftColor: priorityColor[item.priority] },
                item.done && styles.doneCard
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.cardText, item.done && styles.doneText]}>{item.text}</Text>
                <Text style={[styles.badge, { backgroundColor: priorityColor[item.priority] }]}>
                  {item.priority.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => setMenuIndex(menuIndex === index ? null : index)}>
                <Text style={styles.menuDots}>⋮</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => deleteTask(index)}>
                <Text style={styles.deleteButton}>🗑️</Text>
              </TouchableOpacity>
            </View>

            {menuIndex === index && (
              <View style={styles.menuBox}>
                <TouchableOpacity onPress={() => setPriority(index, "low")}><Text style={styles.menuItem}>⬇️ Bassa</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPriority(index, "medium")}><Text style={styles.menuItem}>〰️ Media</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPriority(index, "high")}><Text style={styles.menuItem}>⬆️ Alta</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
        keyExtractor={(item, index) => index.toString()}
      />

      {/* ✅ MODAL PER AGGIUNGERE TASK */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuova attività</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Scrivi la tua task..."
              value={task}
              onChangeText={setTask}
              placeholderTextColor="#aaa"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={addTask}>
                <Text style={styles.saveText}>Aggiungi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ FLOATING BUTTON */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: "#f8f9fa" },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: 10 },

  // CARD TASK
  cardWrapper: { marginHorizontal: 16, marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardText: { fontSize: 16, fontWeight: "500" },
  doneCard: { opacity: 0.5 },
  doneText: { textDecorationLine: "line-through" },
  badge: { paddingHorizontal: 10, paddingVertical: 2, color: "#fff", fontWeight: "700", borderRadius: 20, fontSize: 11 },
  actionRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  menuDots: { fontSize: 18, marginRight: 10 },
  deleteButton: { fontSize: 18 },
  menuBox: { backgroundColor: "#fff", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#ccc", marginTop: 5 },
  menuItem: { paddingVertical: 6, fontSize: 14 },

  // FLOATING BUTTON
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#4e73df",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5
  },
  fabText: { fontSize: 34, color: "#fff", lineHeight: 34 },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalBox: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    elevation: 5
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 15
  },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  cancelBtn: { padding: 10 },
  cancelText: { color: "#555", fontSize: 16 },
  saveBtn: { backgroundColor: "#4e73df", padding: 10, borderRadius: 10 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" }
});
