import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
  Keyboard,
  Modal,
} from 'react-native';

// --- HILFSFUNKTIONEN ---
const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
};

const formatTime = (date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const getDayIndex = (ts) => {
  const day = new Date(ts).getDay();
  return day === 0 ? 6 : day - 1; // Mo=0, So=6
};

const formatDuration = (ms) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

export default function App() {
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('Home');
  const [limit, setLimit] = useState(20);
  const [timer, setTimer] = useState('00:00:00');
  const [darkMode, setDarkMode] = useState(false);
  const [sleepStart, setSleepStart] = useState(null);
  const [sleepSessions, setSleepSessions] = useState([]);
  const [isQuickAddModalVisible, setQuickAddModalVisible] = useState(false);
  const [selectedHeatDay, setSelectedHeatDay] = useState(null);

  const theme = darkMode ? {
    bg: '#1C1C1E', white: '#2C2C2E', text: '#FFFFFF', sub: '#8E8E93', primary: '#0A84FF',
    green: '#34C759', orange: '#FF9500', red: '#FF3B30', sleep: '#5856D6',
    recordGreen: '#1C3D2E', recordOrange: '#4D2D18'
  } : {
    bg: '#F2F2F7', white: '#FFFFFF', text: '#1C1C1E', sub: '#8E8E93', primary: '#007AFF',
    green: '#34C759', orange: '#FF9500', red: '#FF3B30', sleep: '#5856D6',
    recordGreen: '#E8F5E9', recordOrange: '#FFF3E0'
  };

  const startSleep = () => { if (!sleepStart) setSleepStart(Date.now()); };
  const endSleep = () => {
    if (sleepStart) {
      setSleepSessions(prev => [...prev, { start: sleepStart, end: Date.now() }]);
      setSleepStart(null);
    }
  };

  const isInSleep = (start, end) => sleepSessions.some(s => start < s.end && end > s.start);

  const bestTimes = useMemo(() => {
    const sorted = [...entries].sort((a,b) => a.ts - b.ts);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const start = sorted[i-1].ts;
      const end = sorted[i].ts;
      if (!isInSleep(start, end)) { gaps.push({ diff: end - start, date: sorted[i].date }); }
    }
    const bestEver = gaps.length > 0 ? Math.max(...gaps.map(g => g.diff)) : 0;
    const today = formatDate(new Date());
    const todayGaps = gaps.filter(g => g.date === today);
    const bestToday = todayGaps.length > 0 ? Math.max(...todayGaps.map(g => g.diff)) : 0;
    return { bestEver, bestToday };
  }, [entries, sleepSessions]);

  useEffect(() => {
    const itv = setInterval(() => {
      if (entries.length === 0) return setTimer('00:00:00');
      const sorted = [...entries].sort((a,b) => b.ts - a.ts);
      const diff = Math.floor((Date.now() - sorted[0].ts) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setTimer(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(itv);
  }, [entries]);

  const addQuickWithCategory = (cat) => {
    const now = new Date();
    const newE = { id: Date.now().toString(), ts: now.getTime(), date: formatDate(now), time: formatTime(now), category: cat };
    setEntries(prev => [newE, ...prev].sort((a, b) => b.ts - a.ts));
    setQuickAddModalVisible(false);
  };

  const progress = useMemo(() => {
    const today = formatDate(new Date());
    const count = entries.filter(e => e.date === today).length;
    const perc = Math.round((count / limit) * 100);
    let color = theme.green;
    if (perc > 100) color = theme.red;
    return { count, perc, color };
  }, [entries, limit, theme]);

  const heatmapData = useMemo(() => {
    const daysToShow = 84;
    const today = new Date();
    today.setHours(0,0,0,0);
    const counts = {};
    entries.forEach(e => { counts[e.date] = (counts[e.date] || 0) + 1; });
    const currentDayIdx = getDayIndex(today.getTime());
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - currentDayIdx));
    const days = [];
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      const dateStr = formatDate(d);
      const count = counts[dateStr] || 0;
      let color = theme.recordGreen;
      if (count > 0) color = count > limit ? theme.red : theme.green;
      days.unshift({ date: dateStr, dayName: ['Mo','Di','Mi','Do','Fr','Sa','So'][getDayIndex(d.getTime())], count, color, isFuture: d > today });
    }
    return days;
  }, [entries, limit, theme]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <View style={styles.header}><Text style={styles.headerTitle}>Smoke Tracker</Text></View>
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {activeTab === 'Home' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.heroCard}>
              <Text style={[styles.heroSub, { color: theme.sub }]}>Zeit seit letztem Eintrag</Text>
              <Text style={[styles.heroTimer, { color: theme.text }]}>{timer}</Text>
              <View style={styles.recordsRow}>
                <View style={[styles.recordCard, { backgroundColor: theme.recordGreen }]}>
                  <Text style={styles.recordIcon}>🏆</Text>
                  <Text style={[styles.recordValue, { color: theme.text }]}>{formatDuration(bestTimes.bestToday)}</Text>
                </View>
                <View style={styles.recordSpacing} />
                <View style={[styles.recordCard, { backgroundColor: theme.recordOrange }]}>
                  <Text style={styles.recordIcon}>🥇</Text>
                  <Text style={[styles.recordValue, { color: theme.text }]}>{formatDuration(bestTimes.bestEver)}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.card, { backgroundColor: theme.white }]}>
               <Text style={[styles.cardTitle, { color: theme.text }]}>Tagesfortschritt: {progress.count} / {limit}</Text>
               <View style={[styles.progressBase, { backgroundColor: darkMode ? '#3A3A3C' : '#E5E5EA' }]}>
                 <View style={[styles.progressFill, { width: `${Math.min(progress.perc, 100)}%`, backgroundColor: progress.color }]} />
               </View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: sleepStart ? theme.red : theme.sleep, marginHorizontal: 20}]} onPress={sleepStart ? endSleep : startSleep}>
               <Text style={styles.btnText}>{sleepStart ? '☀️ Aufwachen' : '🌙 Schlafen gehen'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {activeTab === 'Stats' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>📅 Heatmap</Text>
              <View style={styles.heatmapGrid}>
                {heatmapData.map((day, i) => (
                  <View key={i} style={[styles.heatmapSquare, { backgroundColor: day.isFuture ? (darkMode ? '#2C2C2E' : '#E5E5EA') : day.color, opacity: day.isFuture ? 0.3 : 1 }]} />
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {activeTab === 'Home' && (
        <TouchableOpacity style={styles.fab} onPress={() => setQuickAddModalVisible(true)}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={isQuickAddModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.card, { backgroundColor: theme.white, padding: 30 }]}>
            <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: theme.primary, marginBottom: 10}]} onPress={() => addQuickWithCategory('Freizeit')}><Text style={styles.btnText}>Freizeit</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: theme.orange}]} onPress={() => addQuickWithCategory('Arbeit')}><Text style={styles.btnText}>Arbeit</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setQuickAddModalVisible(false)} style={{marginTop:20}}><Text style={{textAlign:'center', color:theme.red}}>Abbrechen</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.tabBar, { backgroundColor: theme.white }]}>
        {[{id:'Home', i:'🏠'}, {id:'Stats', i:'📊'}].map(t => (
          <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => setActiveTab(t.id)}>
            <Text style={{ fontSize: 24, opacity: activeTab === t.id ? 1 : 0.4 }}>{t.i}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: '#34C759' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  scroll: { padding: 20 },
  heroCard: { alignItems: 'center', marginBottom: 20 },
  heroTimer: { fontSize: 40, fontWeight: '800' },
  recordsRow: { flexDirection: 'row', marginTop: 15 },
  recordCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  recordSpacing: { width: 10 }, // DIESE ZEILE FIXXT DEN FEHLER
  recordValue: { fontSize: 14, fontWeight: '700' },
  card: { borderRadius: 15, padding: 15, marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  progressBase: { height: 8, borderRadius: 4, marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 4 },
  primaryBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 100, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  fabIcon: { color: '#FFF', fontSize: 30 },
  tabBar: { height: 70, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#DDD' },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 40 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapSquare: { width: 14, height: 14, borderRadius: 2 }
});

