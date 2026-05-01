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
  const [importText, setImportText] = useState('');
  
  const [selHour, setSelHour] = useState(null);
  const [selDay, setSelDay] = useState(null);

  const [editItem, setEditItem] = useState(null);
  const [editD, setEditD] = useState('');
  const [editT, setEditT] = useState('');
  const [editCat, setEditCat] = useState('Freizeit');

  const [isQuickAddModalVisible, setQuickAddModalVisible] = useState(false);

  const [goalPerDay, setGoalPerDay] = useState('');
  const [goalDays, setGoalDays] = useState('');

  const [darkMode, setDarkMode] = useState(false);

  // --- UI STATES ---
  const [showVacation, setShowVacation] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [showGoal, setShowGoal] = useState(false);

  // --- URLAUB STATES ---
  const [vacations, setVacations] = useState([]);
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const vacEndRef = useRef(null);

  // --- DYNAMISCHES THEME ---
  const theme = darkMode ? {
    bg: '#1C1C1E',
    white: '#2C2C2E',
    text: '#FFFFFF',
    sub: '#8E8E93',
    primary: '#0A84FF',
    primaryDark: '#0056b3',
    green: '#34C759',
    orange: '#FF9500',
    red: '#FF3B30',
    purple: '#AF52DE',
    sleep: '#5856D6',
    recordGreen: '#1C3D2E',
    recordOrange: '#4D2D18',
    cardShadow: '#000000'
  } : {
    bg: '#F2F2F7',
    white: '#FFFFFF',
    text: '#1C1C1E',
    sub: '#8E8E93',
    primary: '#007AFF',
    primaryDark: '#0056b3',
    green: '#34C759',
    orange: '#FF9500',
    red: '#FF3B30',
    purple: '#AF52DE',
    sleep: '#5856D6',
    recordGreen: '#E8F5E9',
    recordOrange: '#FFF3E0',
    cardShadow: '#000000'
  };

  const isInVacation = (dateStr) => {
    return vacations.some(v => dateStr >= v.start && dateStr <= v.end);
  };

  const handleVacD = (v, setter, nextRef) => {
    const clean = v.replace(/[^0-9]/g, '');
    let f = clean;
    if (clean.length > 4) f = `${clean.slice(0, 2)}.${clean.slice(2, 4)}.${clean.slice(4, 8)}`;
    else if (clean.length > 2) f = `${clean.slice(0, 2)}.${clean.slice(2, 4)}`;
    setter(f);
    if (clean.length === 8 && nextRef) nextRef.current?.focus();
  };

  const saveVacation = () => {
    if (vacStart.length === 10 && vacEnd.length === 10) {
      const newVac = {
        id: Date.now().toString(),
        start: vacStart,
        end: vacEnd
      };
      setVacations(prev => [...prev, newVac]);
      setVacStart('');
      setVacEnd('');
      Keyboard.dismiss();
    } else {
      Alert.alert("Hinweis", "Bitte Start- und Enddatum vollständig eingeben.");
    }
  };

  const deleteVacation = (id) => {
    setVacations(prev => prev.filter(v => v.id !== id));
  };

  const [sleepSessions, setSleepSessions] = useState([]);
  const [sleepStart, setSleepStart] = useState(null);

  const startSleep = () => {
    if (sleepStart !== null) return;
    setSleepStart(Date.now());
  };

  const endSleep = () => {
    if (sleepStart === null) return;
    setSleepSessions(prev => [
      ...prev,
      { start: sleepStart, end: Date.now() }
    ]);
    setSleepStart(null);
  };

  const isInSleep = (start, end) => {
    return sleepSessions.some(s =>
      start < s.end && end > s.start
    );
  };

  const handleEditDate = (v) => {
    const clean = v.replace(/[^0-9]/g, '');
    let f = clean;
    if (clean.length > 4) {
      f = `${clean.slice(0, 2)}.${clean.slice(2, 4)}.${clean.slice(4, 8)}`;
    } else if (clean.length > 2) {
      f = `${clean.slice(0, 2)}.${clean.slice(2, 4)}`;
    }
    setEditD(f);
  };

  const handleEditTime = (v) => {
    const clean = v.replace(/[^0-9]/g, '');
    let f = clean;
    if (clean.length > 2) {
      f = `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
    }
    setEditT(f);
  };

  const bestTimes = useMemo(() => {
    const sorted = [...entries].sort((a,b) => a.ts - b.ts);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const start = sorted[i-1].ts;
      const end = sorted[i].ts;
      const diff = end - start;
      if (!isInSleep(start, end)) {
        gaps.push({ diff, date: sorted[i].date });
      }
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
    const newE = { 
      id: Date.now().toString(), 
      ts: now.getTime(), 
      date: formatDate(now), 
      time: formatTime(now),
      category: cat 
    };
    setEntries(prev => [newE, ...prev].sort((a, b) => b.ts - a.ts));
    setQuickAddModalVisible(false);
  };

  const deleteEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id).sort((a, b) => b.ts - a.ts));

  const stats = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const weekLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const freizeitHours = Array(24).fill(0);
    const arbeitHours = Array(24).fill(0);
    const weekFreizeitAvgs = Array(7).fill(0);
    const weekArbeitAvgs = Array(7).fill(0);
    
    const filteredEntriesForTotal = entries.filter(e => !isInVacation(e.date));
    const workTotalCount = filteredEntriesForTotal.filter(e => e.category === 'Arbeit').length;
    const freeTotalCount = filteredEntriesForTotal.filter(e => e.category === 'Freizeit').length;
    const catTotal = workTotalCount + freeTotalCount;
    const workPercTotal = catTotal > 0 ? Math.round((workTotalCount / catTotal) * 100) : 0;
    const freePercTotal = catTotal > 0 ? Math.round((freeTotalCount / catTotal) * 100) : 0;

    const getISOWeekMonday = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay(); 
      const diff = d.getDate() - (day === 0 ? 6 : day - 1);
      return new Date(d.setDate(diff));
    };

    const parseDateString = (dateStr) => {
      const [day, month, year] = dateStr.split('.').map(Number);
      return new Date(year, month - 1, day).getTime();
    };

    const now = new Date();
    const startCurrentWeek = getISOWeekMonday(now).getTime();
    const startPreviousWeek = startCurrentWeek - (7 * 24 * 60 * 60 * 1000);

    const currentCount = entries.filter(e => {
      const entryTs = parseDateString(e.date);
      return entryTs >= startCurrentWeek;
    }).length;

    const previousCount = entries.filter(e => {
      const entryTs = parseDateString(e.date);
      return entryTs >= startPreviousWeek && entryTs < startCurrentWeek;
    }).length;

    let trendVal = "";
    let trendColor = theme.sub;

    if (previousCount === 0) {
      trendVal = currentCount > 0 ? "100%" : "0%";
      if (currentCount > 0) trendColor = theme.red;
    } else {
      let trendPercent = 0;
      if (currentCount === previousCount) {
        trendPercent = 0;
        trendColor = theme.sub;
      } else {
        trendPercent = Math.round(Math.abs(((currentCount - previousCount) / previousCount) * 100));
        trendColor = currentCount > previousCount ? theme.red : theme.green;
      }
      trendVal = `${trendPercent}%`;
    }

    const debugInfo = `Diese W: ${currentCount} | Letzte W: ${previousCount}`;

    if (entries.length === 0) {
      return { hours, weekLabels, empty: true, freizeitHours, arbeitHours, freizeitWeek: weekFreizeitAvgs, arbeitWeek: weekArbeitAvgs, maxValue: 1, maxWeekValue: 1, dayCount: 0, workTotalCount, freeTotalCount, workPercTotal, freePercTotal, trendVal, trendColor, debugInfo };
    }

    const uniqueDates = Array.from(new Set(entries.map(e => e.date)));
    const dayCount = uniqueDates.length || 1;
    const dailyMatrix = {}; 
    uniqueDates.forEach(date => { 
      dailyMatrix[date] = { freizeit: Array(24).fill(0), arbeit: Array(24).fill(0), totalFreizeit: 0, totalArbeit: 0 }; 
    });

    entries.forEach(e => {
      const h = parseInt(e.time.split(':')[0], 10);
      if (dailyMatrix[e.date]) {
        if (e.category === 'Freizeit') { dailyMatrix[e.date].freizeit[h]++; dailyMatrix[e.date].totalFreizeit++; }
        else if (e.category === 'Arbeit') { dailyMatrix[e.date].arbeit[h]++; dailyMatrix[e.date].totalArbeit++; }
      }
    });

    hours.forEach(h => {
      let sumF = 0; let activeDaysF = 0;
      let sumA = 0; let activeDaysA = 0;
      uniqueDates.forEach(date => {
        const valF = dailyMatrix[date].freizeit[h];
        const valA = dailyMatrix[date].arbeit[h];
        sumF += valF; if (valF > 0) activeDaysF++;
        sumA += valA; if (valA > 0) activeDaysA++;
      });
      freizeitHours[h] = activeDaysF > 0 ? sumF / activeDaysF : 0;
      arbeitHours[h] = activeDaysA > 0 ? sumA / activeDaysA : 0;
    });

    for (let i = 0; i < 7; i++) {
      let sumF = 0; let activeDaysF = 0;
      let sumA = 0; let activeDaysA = 0;
      uniqueDates.forEach(date => {
        const [d, m, y] = date.split('.');
        const dayIdx = getDayIndex(new Date(y, m - 1, d).getTime());
        if (dayIdx === i) {
          const valF = dailyMatrix[date].totalFreizeit;
          const valA = dailyMatrix[date].totalArbeit;
          if (valF > 0) { sumF += valF; activeDaysF++; }
          if (valA > 0) { sumA += valA; activeDaysA++; }
        }
      });
      weekFreizeitAvgs[i] = activeDaysF > 0 ? sumF / activeDaysF : 0;
      weekArbeitAvgs[i] = activeDaysA > 0 ? sumA / activeDaysA : 0;
    }

    const maxValue = Math.max(...freizeitHours, ...arbeitHours, 0.1);
    const maxWeekValue = Math.max(...weekFreizeitAvgs, ...weekArbeitAvgs, 1);

    return { 
      empty: false, totalAvg: (entries.length / dayCount).toFixed(1), dayCount, hours, freizeitHours, arbeitHours, maxValue, weekLabels, freizeitWeek: weekFreizeitAvgs, arbeitWeek: weekArbeitAvgs, maxWeekValue, workTotalCount, freeTotalCount, workPercTotal, freePercTotal, trendVal, trendColor, debugInfo
    };
  }, [entries, vacations, theme, darkMode]);

  const goalStats = useMemo(() => {
    if (entries.length === 0 || !goalPerDay || !goalDays) return { percent: 0, successDays: 0, totalDays: 0 };
    const sorted = [...entries].sort((a,b) => b.ts - a.ts);
    const cutoff = new Date();
    cutoff.setHours(0,0,0,0);
    cutoff.setDate(cutoff.getDate() - parseInt(goalDays));
    const recentEntries = sorted.filter(e => new Date(e.ts) >= cutoff);
    const daysMap = {};
    recentEntries.forEach(e => { if (!daysMap[e.date]) daysMap[e.date] = 0; daysMap[e.date]++; });
    const totalDays = Object.keys(daysMap).length;
    let successDays = 0;
    const maxVal = parseInt(goalPerDay);
    Object.values(daysMap).forEach(count => { if (count <= maxVal) successDays++; });
    return { percent: totalDays > 0 ? Math.round((successDays / totalDays) * 100) : 0, successDays, totalDays };
  }, [entries, goalPerDay, goalDays]);

  const progress = useMemo(() => {
    const today = formatDate(new Date());
    const count = entries.filter(e => e.date === today).length;
    const perc = Math.round((count / limit) * 100);
    let color = theme.green;
    if (perc > 100) color = theme.purple;
    else if (perc > 67) color = theme.red;
    else if (perc > 33) color = theme.orange;
    return { count, perc, color };
  }, [entries, limit, theme]);

  const getCategoryColor = (cat) => cat === 'Arbeit' ? theme.orange : theme.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}> Smoking Stop</Text>
      </View>
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {activeTab === 'Home' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.heroCard}>
              <Text style={[styles.heroSub, { color: theme.sub }]}>Zeit seit letztem Eintrag</Text>
              <Text style={[styles.heroTimer, { color: theme.text }]}>{timer}</Text>
              
              <View style={styles.recordsRow}>
                <View style={[styles.recordCard, { backgroundColor: theme.recordGreen }]}>
                  <Text style={styles.recordIcon}>🏆</Text>
                  <Text style={[styles.recordLabel, { color: theme.sub }]}>Tagesrekord</Text>
                  <Text style={[styles.recordValue, { color: theme.text }]}>{formatDuration(bestTimes.bestToday)}</Text>
                </View>
                <View style={styles.recordSpacing} />
                <View style={[styles.recordCard, { backgroundColor: theme.recordOrange }]}>
                  <Text style={styles.recordIcon}>🥇</Text>
                  <Text style={[styles.recordLabel, { color: theme.sub }]}>Allzeit-Rekord</Text>
                  <Text style={[styles.recordValue, { color: theme.text }]}>{formatDuration(bestTimes.bestEver)}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Schlaf-Modus</Text>
              {sleepStart ? (
                <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: theme.red}]} onPress={endSleep}>
                  <Text style={styles.btnText}>☀️ Aufwachen</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: theme.sleep}]} onPress={startSleep}>
                  <Text style={styles.btnText}>🌙 Schlafen gehen</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Tagesfortschritt</Text>
                <Text style={[styles.cardTitle, { color: progress.color }]}>{progress.count} / {limit}</Text>
              </View>
              <View style={[styles.progressBase, { backgroundColor: darkMode ? '#3A3A3C' : '#E5E5EA' }]}>
                <View style={[styles.progressFill, { width: `${Math.min(progress.perc, 100)}%`, backgroundColor: progress.color }]} />
              </View>
              <Text style={[styles.progressText, { color: theme.sub }]}>{progress.perc}%</Text>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {activeTab === 'History' && (
          <FlatList
            data={entries}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.scroll}
            renderItem={({ item }) => (
              <View style={[styles.historyCard, { borderLeftColor: getCategoryColor(item.category), backgroundColor: theme.white }]}>
                <View>
                  <Text style={[styles.histD, { color: theme.text }]}>{item.date} {isInVacation(item.date) ? '🌴' : ''}</Text>
                  <Text style={[styles.histT, { color: theme.sub }]}>{item.time} Uhr — <Text style={{color: getCategoryColor(item.category), fontWeight: '600'}}>{item.category || 'Freizeit'}</Text></Text>
                </View>
                <View style={styles.row}>
                  <TouchableOpacity onPress={() => { setEditItem(item); setEditD(item.date); setEditT(item.time); setEditCat(item.category || 'Freizeit'); }} style={styles.iconBtn}>
                    <Text style={{fontSize: 20}}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteEntry(item.id)} style={styles.iconBtn}>
                    <Text style={{fontSize: 20}}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.sub }]}>Keine Einträge.</Text>}
          />
        )}

        {activeTab === 'Stats' && (
          <ScrollView contentContainerStyle={styles.scroll}>

            {/* 📈 TREND */}
            <View style={[styles.flatCard, { backgroundColor: theme.white }]}>
              <View style={styles.flatLeft}>
                <Text style={[styles.flatTitle, { color: theme.text }]}>📈 Trend</Text>
                <Text style={[styles.flatSub, { color: theme.sub }]}>
                  Vergleich zur Vorwoche
                </Text>
              </View>
              <Text style={[styles.flatValue, { color: stats.trendColor }]}>
                {stats.trendVal}
              </Text>
            </View>

            {/* ⚖️ AUFTEILUNG */}
            <View style={[styles.flatCard, { backgroundColor: theme.white }]}>
              <View style={styles.flatLeft}>
                <Text style={[styles.flatTitle, { color: theme.text }]}>⚖️ Aufteilung</Text>
                <Text style={[styles.flatSub, { color: theme.sub }]}>
                  Freizeit / Arbeit
                </Text>

                <View style={[styles.progressBase, { marginTop: 6, flexDirection: 'row', height: 4 }]}>
                  <View style={{
                    width: `${stats.freePercTotal}%`,
                    backgroundColor: theme.primary,
                    height: '100%'
                  }}/>
                  <View style={{
                    width: `${stats.workPercTotal}%`,
                    backgroundColor: theme.orange,
                    height: '100%'
                  }}/>
                </View>
              </View>

              <Text style={[styles.flatValue, { color: theme.text }]}>
                {stats.freePercTotal}% / {stats.workPercTotal}%
              </Text>
            </View>

            {/* 🎯 ZIEL */}
            <View style={[styles.flatCard, { backgroundColor: theme.white }]}>
              <View style={styles.flatLeft}>
                <Text style={[styles.flatTitle, { color: theme.text }]}>🎯 Ziel</Text>
                <Text style={[styles.flatSub, { color: theme.sub }]}>
                  Fortschritt
                </Text>

                <View style={[styles.progressBase, { marginTop: 6, height: 4 }]}>
                  <View style={{
                    width: `${goalStats.percent}%`,
                    backgroundColor: theme.green,
                    height: '100%'
                  }}/>
                </View>
              </View>

              <Text style={[styles.flatValue, { color: theme.text }]}>
                {goalStats.percent}%
              </Text>
            </View>

            {/* 📊 Ø PRO TAG */}
            <View style={[styles.flatCard, { backgroundColor: theme.white }]}>
              <View style={styles.flatLeft}>
                <Text style={[styles.flatTitle, { color: theme.text }]}>
                  Ø pro Tag
                </Text>
                <Text style={[styles.flatSub, { color: theme.sub }]}>
                  {stats.dayCount} Tage
                </Text>
              </View>

              <Text style={[styles.flatValue, { color: theme.text }]}>
                {stats.empty ? '0.0' : stats.totalAvg}
              </Text>
            </View>

            {/* DETAIL ANALYSEN */}
            <View style={[styles.card, { backgroundColor: theme.white, marginTop: 10 }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Ø Verteilung nach Uhrzeit</Text>
              <View style={[styles.tooltipContainer, { backgroundColor: darkMode ? '#3A3A3C' : '#F2F2F7' }]}>
                <Text style={[styles.tooltipText, { color: theme.primary }]} numberOfLines={1}>
                  {selHour !== null 
                    ? `${selHour.toString().padStart(2, '0')}:00 → F: ${stats.freizeitHours[selHour].toFixed(1)} | A: ${stats.arbeitHours[selHour].toFixed(1)}` 
                    : 'Balken wählen'}
                </Text>
              </View>
              <View style={styles.chartAreaHourly}>
                {stats.hours.map((hour) => {
                  const valF = stats.freizeitHours[hour];
                  const valA = stats.arbeitHours[hour];
                  const heightF = Math.max(2, (valF / stats.maxValue) * 100);
                  const heightA = Math.max(2, (valA / stats.maxValue) * 100);
                  return (
                    <TouchableOpacity key={hour} onPress={() => setSelHour(hour)} style={styles.barColFixed}>
                      <View style={styles.barRowDouble}>
                        <View style={[styles.barFill, { height: heightF, backgroundColor: theme.primary, opacity: selHour === hour ? 1 : 0.8, width: 4 }]} />
                        <View style={[styles.barFill, { height: heightA, backgroundColor: theme.orange, opacity: selHour === hour ? 1 : 0.8, width: 4 }]} />
                      </View>
                      <Text style={[styles.hourLabel, { color: theme.sub, opacity: hour % 2 === 0 ? 1 : 0.4 }]}>{hour.toString().padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Ø Verteilung nach Wochentag</Text>
              <View style={[styles.tooltipContainer, { backgroundColor: darkMode ? '#3A3A3C' : '#F2F2F7' }]}>
                <Text style={[styles.tooltipText, { color: theme.primary }]}>
                  {selDay !== null 
                    ? `${stats.weekLabels[selDay]} → F: ${stats.freizeitWeek[selDay].toFixed(1)} | A: ${stats.arbeitWeek[selDay].toFixed(1)}` 
                    : 'Balken wählen'}
                </Text>
              </View>
              <View style={[styles.chartArea, { height: 120 }]}>
                {stats.weekLabels.map((label, i) => {
                  const valF = stats.freizeitWeek[i];
                  const valA = stats.arbeitWeek[i];
                  const heightF = Math.max(4, (valF / stats.maxWeekValue) * 100);
                  const heightA = Math.max(4, (valA / stats.maxWeekValue) * 100);
                  return (
                    <TouchableOpacity key={label} onPress={() => setSelDay(i)} style={styles.barCol}>
                      <View style={styles.barRowDouble}>
                        <View style={[styles.barFill, { height: heightF, backgroundColor: theme.primary, opacity: selDay === i ? 1 : 0.8, borderRadius: 3, width: 12 }]} />
                        <View style={[styles.barFill, { height: heightA, backgroundColor: theme.orange, opacity: selDay === i ? 1 : 0.8, borderRadius: 3, width: 12 }]} />
                      </View>
                      <Text style={[styles.labelSmall, { color: theme.sub, marginTop: 6 }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {activeTab === 'Settings' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.headerArea}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>⚙️ Einstellungen</Text>
            </View>

            <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: theme.white }]} onPress={() => { setShowLimit(prev => !prev); setShowGoal(false); setShowVacation(false); }}>
              <Text style={[styles.accordionTitle, { color: theme.text }]}>{showLimit ? '▼' : '▶'} ⚙️ Tageslimit</Text>
            </TouchableOpacity>
            {showLimit && (
              <View style={[styles.card, { backgroundColor: theme.white }]}>
                <Text style={[styles.label, { color: theme.sub }]}>Tagesziel (Stück):</Text>
                <TextInput style={[styles.input, { width: '100%', marginTop: 8, color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9' }]} keyboardType="numeric" value={limit.toString()} onChangeText={v => setLimit(parseInt(v) || 0)} />
              </View>
            )}

            <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: theme.white }]} onPress={() => { setShowGoal(prev => !prev); setShowLimit(false); setShowVacation(false); }}>
              <Text style={[styles.accordionTitle, { color: theme.text }]}>{showGoal ? '▼' : '▶'} 🎯 Reduktionsziel</Text>
            </TouchableOpacity>
            {showGoal && (
              <View style={[styles.card, { backgroundColor: theme.white }]}>
                <Text style={[styles.label, { color: theme.sub }]}>Max. Zigaretten pro Tag</Text>
                <TextInput style={[styles.input, { width: '100%', marginTop: 8, color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9' }]} keyboardType="numeric" value={goalPerDay ? goalPerDay.toString() : ''} onChangeText={v => setGoalPerDay(v.replace(/[^0-9]/g, ''))} placeholder="z.B. 10" placeholderTextColor={theme.sub} />
                <Text style={[styles.label, { color: theme.sub, marginTop: 12 }]}>Zeitraum (Tage)</Text>
                <TextInput style={[styles.input, { width: '100%', marginTop: 8, color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9' }]} keyboardType="numeric" value={goalDays ? goalDays.toString() : ''} onChangeText={v => setGoalDays(v.replace(/[^0-9]/g, ''))} placeholder="z.B. 7" placeholderTextColor={theme.sub} />
              </View>
            )}

            <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: theme.white }]} onPress={() => { setShowVacation(prev => !prev); setShowLimit(false); setShowGoal(false); }}>
              <Text style={[styles.accordionTitle, { color: theme.text }]}>{showVacation ? '▼' : '▶'} 🌴 Urlaub planen</Text>
            </TouchableOpacity>
            {showVacation && (
              <View style={[styles.card, { backgroundColor: theme.white }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Urlaubszeitraum</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9' }]} placeholder="Start TTMMJJJJ" placeholderTextColor={theme.sub} value={vacStart} onChangeText={(v) => handleVacD(v, setVacStart, vacEndRef)} keyboardType="numeric" maxLength={10} />
                  <TextInput ref={vacEndRef} style={[styles.input, { color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9' }]} placeholder="Ende TTMMJJJJ" placeholderTextColor={theme.sub} value={vacEnd} onChangeText={(v) => handleVacD(v, setVacEnd, null)} keyboardType="numeric" maxLength={10} />
                </View>
                <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: theme.orange}]} onPress={saveVacation}><Text style={styles.btnText}>Urlaub speichern</Text></TouchableOpacity>
                {vacations.length > 0 && (
                  <View style={{marginTop: 20}}>
                    <Text style={[styles.label, { color: theme.sub, marginBottom: 10}]}>Gespeicherte Urlaube:</Text>
                    {vacations.map(v => (
                      <View key={v.id} style={[styles.vacationItem, { backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9' }]}>
                        <Text style={[styles.vacationText, { color: theme.text }]}>{v.start} - {v.end}</Text>
                        <TouchableOpacity onPress={() => deleteVacation(v.id)}><Text style={{color: theme.red, fontWeight: 'bold'}}>Löschen</Text></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>👨‍💻 Entwicklerinfo</Text>
              <Text style={[styles.label, { color: theme.sub }]}>Entwickler: Özgür Cetin</Text>
              <Text style={[styles.label, { color: theme.sub, marginTop: 4 }]}>E-Mail: ozgur.cetin@web.de</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>💾 Backup</Text>
              <TextInput style={[styles.input, { width: '100%', marginBottom: 12, height: 60, color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9' }]} multiline value={importText} onChangeText={setImportText} placeholder="JSON Text..." placeholderTextColor={theme.sub} />
              <View style={styles.rowBetween}>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginRight: 5 }]} onPress={() => setImportText(JSON.stringify(entries))}><Text style={styles.btnText}>Export</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1, backgroundColor: theme.purple }]} onPress={() => { try { const d = JSON.parse(importText); if (Array.isArray(d)) setEntries(d.sort((a,b) => b.ts - a.ts)); } catch(e) { Alert.alert("Fehler"); } }}><Text style={styles.btnText}>Import</Text></TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>🌙 Dark Mode</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setDarkMode(prev => !prev)}>
                <Text style={styles.btnText}>{darkMode ? 'Deaktivieren' : 'Aktivieren'}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 100 }} />
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
          <View style={[styles.card, { backgroundColor: theme.white }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Kategorie wählen</Text>
            <View style={styles.categoryToggleRow}>
              <TouchableOpacity style={[styles.toggleBtn, styles.toggleBtnActiveFreizeit, {flex: 1}]} onPress={() => addQuickWithCategory('Freizeit')}><Text style={[styles.toggleBtnText, styles.toggleBtnTextActive]}>Freizeit</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, styles.toggleBtnActiveArbeit, {flex: 1}]} onPress={() => addQuickWithCategory('Arbeit')}><Text style={[styles.toggleBtnText, styles.toggleBtnTextActive]}>Arbeit</Text></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setQuickAddModalVisible(false)} style={{marginTop:15}}><Text style={{textAlign:'center', color:theme.red}}>Abbrechen</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.tabBar, { backgroundColor: theme.white, borderTopColor: theme.sub }]}>
        {[
          {id:'Home', label:'Start', i:'🏠'}, 
          {id:'History', label:'Verlauf', i:'📜'}, 
          {id:'Stats', label:'Statistiken', i:'📊'}, 
          {id:'Settings', label:'Einstellungen', i:'⚙️'}
        ].map(t => (
          <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => setActiveTab(t.id)}>
            <Text style={{ fontSize: 24, opacity: activeTab === t.id ? 1 : 0.4 }}>{t.i}</Text>
            <Text style={[styles.tabLabel, { color: theme.sub }, activeTab === t.id && { color: theme.primary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {editItem && (
        <Modal transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Eintrag bearbeiten</Text>
              <TextInput style={[styles.input, {width:'100%', marginBottom:10, color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9'}]} value={editD} onChangeText={handleEditDate} keyboardType="numeric" maxLength={10} />
              <TextInput style={[styles.input, {width:'100%', marginBottom:10, color: theme.text, backgroundColor: darkMode ? '#3A3A3C' : '#F9F9F9'}]} value={editT} onChangeText={handleEditTime} keyboardType="numeric" maxLength={5} />
              <View style={[styles.categoryToggleRow, {marginBottom: 15}]}>
                <TouchableOpacity style={[styles.toggleBtn, editCat === 'Freizeit' && styles.toggleBtnActiveFreizeit]} onPress={() => setEditCat('Freizeit')}><Text style={[styles.toggleBtnText, editCat === 'Freizeit' && styles.toggleBtnTextActive]}>Freizeit</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, editCat === 'Arbeit' && styles.toggleBtnActiveArbeit]} onPress={() => setEditCat('Arbeit')}><Text style={[styles.toggleBtnText, editCat === 'Arbeit' && styles.toggleBtnTextActive]}>Arbeit</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => { 
                if (editD.length !== 10 || editT.length !== 5) { 
                  Alert.alert("Fehler", "Bitte Datum und Uhrzeit vollständig eingeben."); 
                  return; 
                } 
                const [d, m, y] = editD.split('.').map(Number);
                const [h, min] = editT.split(':').map(Number);
                const updatedTs = new Date(y, m - 1, d, h, min).getTime();
                
                setEntries(prev => prev.map(e => e.id === editItem.id ? {...e, date: editD, time: editT, ts: updatedTs, category: editCat} : e).sort((a, b) => b.ts - a.ts)); 
                setEditItem(null); 
              }}><Text style={styles.btnText}>Sichern</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setEditItem(null)} style={{marginTop:15}}><Text style={{textAlign:'center', color:theme.red}}>Abbrechen</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 75,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 6
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1
  },
  headerArea: { marginBottom: 15 },
  scroll: { padding: 20 },
  heroCard: { alignItems: 'center', marginVertical: 20 },
  heroSub: { fontSize: 12, fontWeight: '600' },
  heroTimer: { fontSize: 50, fontWeight: '800', marginBottom: 15 },
  recordsRow: { flexDirection: 'row', width: '100%', paddingHorizontal: 5 },
  recordCard: { flex: 1, borderRadius: 15, padding: 12, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  recordSpacing: { width: 10 },
  recordIcon: { fontSize: 22, marginBottom: 4 },
  recordLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  recordValue: { fontSize: 18, fontWeight: '800' },
  sectionGroup: { width: '100%', marginBottom: 20 },
  card: { borderRadius: 20, padding: 20, marginBottom: 20, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  progressBase: { height: 6, borderRadius: 3, marginVertical: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { textAlign: 'right', fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#444', borderRadius: 10, padding: 12, width: '48%' },
  categoryToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F2F2F7', alignItems: 'center' },
  toggleBtnActiveFreizeit: { backgroundColor: '#007AFF' },
  toggleBtnActiveArbeit: { backgroundColor: '#FF9500' },
  toggleBtnText: { fontWeight: '600', color: '#1C1C1E' },
  toggleBtnTextActive: { color: '#FFF' },
  primaryBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 15, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '800' },
  fab: { position: 'absolute', bottom: 110, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  fabIcon: { color: '#FFF', fontSize: 30 },
  tabBar: { height: 85, flexDirection: 'row', borderTopWidth: 1, paddingBottom: 25 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  historyCard: { borderRadius: 15, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', elevation: 2, borderLeftWidth: 5 },
  histD: { fontSize: 16, fontWeight: '700' },
  histT: { fontSize: 13 },
  iconBtn: { marginLeft: 15 },
  emptyText: { textAlign: 'center', marginTop: 20 },
  tooltipContainer: { padding: 8, borderRadius: 10, marginBottom: 15, alignItems: 'center', height: 40, justifyContent: 'center' },
  tooltipText: { fontSize: 13, fontWeight: '700' },
  chartAreaHourly: { height: 140, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barColFixed: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barRowDouble: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  barFill: { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  hourLabel: { fontSize: 8, fontWeight: '600', marginTop: 4 },
  chartArea: { height: 100, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  labelSmall: { fontSize: 9 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  label: { fontSize: 14, fontWeight: '600' },
  vacationItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 5 },
  vacationText: { fontSize: 14, fontWeight: '600' },
  accordionHeader: { padding: 15, borderRadius: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  accordionTitle: { fontSize: 16, fontWeight: '700' },
  flatCard: { flexDirection: 'row', padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 10, elevation: 2 },
  flatLeft: { flex: 1 },
  flatTitle: { fontSize: 15, fontWeight: '700' },
  flatSub: { fontSize: 11 },
  flatValue: { fontSize: 20, fontWeight: '800' }
});

