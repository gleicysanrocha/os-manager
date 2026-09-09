'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { db } from '@/lib/firebase';
import {
  DEFAULT_SERVICE_TYPES,
  escapeHtml,
  getLocalDate,
  isDefaultServiceType,
  mergeServiceTypes,
  normalizeServiceTypeName,
  parseCurrency,
  type PaymentMethod,
  type PaymentStatus,
  type ServiceType,
} from '@/lib/os';
import {
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  ClipboardList, 
  LogOut, 
  Plus, 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  MessageSquare, 
  Settings, 
  X, 
  FileText, 
  Trash2,
  TrendingUp,
  User,
  Pencil,
  Sun,
  Moon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface OSEntry {
  id: string;
  date: string;
  serviceType: string;
  osNumber: string;
  value: number;
  notes: string;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  partialAmountPaid?: number;
  userId: string;
}

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // State for OS Entries
  const [entries, setEntries] = useState<OSEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // State for Service Types
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [showConfigTypes, setShowConfigTypes] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeOSRequired, setNewTypeOSRequired] = useState(false);

  // Form State for new entry
  const [date, setDate] = useState(getLocalDate());
  const [serviceType, setServiceType] = useState('');
  const [osNumber, setOsNumber] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('Pendente');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [paymentDate, setPaymentDate] = useState('');
  const [partialAmount, setPartialAmount] = useState('');

  // Filter State
  const [statusFilter, setStatusFilter] = useState<'Todos' | PaymentStatus>('Todos');
  const [monthFilter, setMonthFilter] = useState<string>(''); // YYYY-MM
  const [startDateFilter, setStartDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [endDateFilter, setEndDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [osNumberFilter, setOsNumberFilter] = useState<string>('');

  // Sort State
  const [sortField, setSortField] = useState<'date' | 'serviceType' | 'value' | 'notes' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Clipboard feedback
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Quick Notes templates state
  const [quickNotes, setQuickNotes] = useState<string[]>(['Foi emitido OS e NFS-e', 'Foi emitido apenas OS', 'Venda de Celular', 'Venda de Acessórios']);
  const [newQuickNote, setNewQuickNote] = useState('');
  const [showAddQuickNote, setShowAddQuickNote] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Active space tab (Geral or specific service type)
  const [activeTab, setActiveTab] = useState<string>('Geral');

  // Paying entry editor state
  const [payingEntry, setPayingEntry] = useState<OSEntry | null>(null);
  const [payingStatus, setPayingStatus] = useState<PaymentStatus>('Pendente');
  const [payingMethod, setPayingMethod] = useState<PaymentMethod>('');
  const [payingDate, setPayingDate] = useState('');
  const [payingPartialAmount, setPayingPartialAmount] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const showError = (message: string, error?: unknown) => {
    console.error(message, error);
    setFeedback(message);
    setTimeout(() => setFeedback(null), 5000);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Sync OS Entries from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'os_entries'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entriesList: OSEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        entriesList.push({
          id: doc.id,
          ...data
        } as OSEntry);
      });
      // Client-side sorting by date descending
      entriesList.sort((a, b) => b.date.localeCompare(a.date));
      setEntries(entriesList);
      setLoadingEntries(false);
    }, (error) => {
      console.error("Error loading entries: ", error);
      setLoadingEntries(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Service Types from Firestore (or fallback to defaults)
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'service_types'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const typesList: ServiceType[] = [];
      snapshot.forEach((document) => {
        const data = document.data();
        if (typeof data.name === 'string') {
          typesList.push({
            id: document.id,
            name: data.name,
            osRequired: data.osRequired === true,
          });
        }
      });
      setServiceTypes(mergeServiceTypes(typesList));
    }, (error) => {
      showError('Não foi possível carregar os tipos de serviço.', error);
      setServiceTypes(DEFAULT_SERVICE_TYPES);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Quick Notes from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'quick_notes'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setQuickNotes(['Foi emitido OS e NFS-e', 'Foi emitido apenas OS', 'Venda de Celular', 'Venda de Acessórios']);
      } else {
        const notesList: string[] = [];
        snapshot.forEach((doc) => {
          notesList.push(doc.data().text);
        });
        const defaults = ['Foi emitido OS e NFS-e', 'Foi emitido apenas OS', 'Venda de Celular', 'Venda de Acessórios'];
        const uniqueList = Array.from(new Set([...defaults, ...notesList]));
        setQuickNotes(uniqueList);
      }
    }, (error) => {
      console.error("Error loading quick notes: ", error);
      setQuickNotes(['Foi emitido OS e NFS-e', 'Foi emitido apenas OS', 'Venda de Celular', 'Venda de Acessórios']);
    });

    return () => unsubscribe();
  }, [user]);

  // Set default service type once loaded
  useEffect(() => {
    if (serviceTypes.length > 0 && !serviceType) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setServiceType(serviceTypes[0].name);
    }
  }, [serviceTypes, serviceType]);

  // Synchronize form serviceType selection when switching spaces (tabs)
  useEffect(() => {
    if (activeTab !== 'Geral') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setServiceType(activeTab);
    }
  }, [activeTab]);

  // Pre-populate default values based on service type
  useEffect(() => {
    if (serviceType === 'Geração de OS') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue('10,00');
    } else {
      setValue((prev) => (prev === '10,00' ? '' : prev));
    }
  }, [serviceType]);

  // Set default month filter to the current local month
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonthFilter(getLocalDate().substring(0, 7));
  }, []);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    const selectedType = serviceTypes.find(t => t.name === serviceType);
    if (selectedType?.osRequired && !osNumber.trim()) {
      alert(`O número da OS é obrigatório para o tipo de serviço "${serviceType}".`);
      return;
    }

    const parsedValue = parseCurrency(value);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      alert('Insira um valor numérico válido.');
      return;
    }

    const parsedPartialAmount = status === 'Pago Parcialmente' ? parseCurrency(partialAmount) : 0;
    if (status === 'Pago Parcialmente' && (!Number.isFinite(parsedPartialAmount) || parsedPartialAmount <= 0 || parsedPartialAmount >= parsedValue)) {
      alert('O valor pago parcialmente deve ser maior que 0 e menor que o valor total do serviço.');
      return;
    }

    const editingEntry = editingId ? entries.find((entry) => entry.id === editingId) : undefined;
    if (editingEntry && editingEntry.userId !== user.uid) {
      showError('Você não tem permissão para editar este lançamento.');
      return;
    }

    try {
      const pMethod = status !== 'Pendente' ? (paymentMethod || 'Pix') : '';
      const pDate = status !== 'Pendente' ? (paymentDate || getLocalDate()) : '';

      if (editingId) {
        const docRef = doc(db, 'os_entries', editingId);
        await updateDoc(docRef, {
          date,
          serviceType,
          osNumber: osNumber.trim(),
          value: parsedValue,
          notes: notes.trim(),
          status,
          paymentMethod: pMethod,
          paymentDate: pDate,
          partialAmountPaid: parsedPartialAmount,
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'os_entries'), {
          date,
          serviceType,
          osNumber: osNumber.trim(),
          value: parsedValue,
          notes: notes.trim(),
          status,
          paymentMethod: pMethod,
          paymentDate: pDate,
          partialAmountPaid: parsedPartialAmount,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      }

      setOsNumber('');
      setValue(serviceType === 'Geração de OS' ? '10,00' : '');
      setNotes('');
      setStatus('Pendente');
      setPaymentMethod('');
      setPaymentDate('');
      setPartialAmount('');
    } catch (err) {
      showError('Não foi possível salvar o lançamento.', err);
    }
  };

  const handleStartEdit = (entry: OSEntry) => {
    if (!user || entry.userId !== user.uid) {
      showError('Você não tem permissão para editar este lançamento.');
      return;
    }

    setEditingId(entry.id);
    setDate(entry.date);
    setServiceType(entry.serviceType);
    setOsNumber(entry.osNumber);
    setValue(entry.value.toString().replace('.', ','));
    setNotes(entry.notes);
    setStatus(entry.status);
    setPaymentMethod(entry.paymentMethod || '');
    setPaymentDate(entry.paymentDate || '');
    setPartialAmount(entry.partialAmountPaid ? entry.partialAmountPaid.toString().replace('.', ',') : '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setOsNumber('');
    setValue(serviceType === 'Geração de OS' ? '10,00' : '');
    setNotes('');
    setStatus('Pendente');
    setPaymentMethod('');
    setPaymentDate('');
    setPartialAmount('');
  };

  const handleToggleStatus = (entry: OSEntry) => {
    if (!user || entry.userId !== user.uid) {
      showError('Você não tem permissão para atualizar este lançamento.');
      return;
    }

    setPayingEntry(entry);
    setPayingStatus(entry.status);
    setPayingMethod(entry.paymentMethod || 'Pix');
    setPayingDate(entry.paymentDate || getLocalDate());
    setPayingPartialAmount(entry.partialAmountPaid ? entry.partialAmountPaid.toString().replace('.', ',') : '');
  };

  const handleSavePaymentDetails = async () => {
    if (!payingEntry || !user) return;
    if (payingEntry.userId !== user.uid) {
      showError('Você não tem permissão para atualizar este lançamento.');
      return;
    }

    const parsedPartial = payingStatus === 'Pago Parcialmente' ? parseCurrency(payingPartialAmount) : 0;
    if (payingStatus === 'Pago Parcialmente' && (!Number.isFinite(parsedPartial) || parsedPartial <= 0 || parsedPartial >= payingEntry.value)) {
      alert('O valor pago parcialmente deve ser maior que 0 e menor que o valor total do serviço.');
      return;
    }

    try {
      const pMethod = payingStatus !== 'Pendente' ? (payingMethod || 'Pix') : '';
      const pDate = payingStatus !== 'Pendente' ? (payingDate || getLocalDate()) : '';

      const docRef = doc(db, 'os_entries', payingEntry.id);
      await updateDoc(docRef, {
        status: payingStatus,
        paymentMethod: pMethod,
        paymentDate: pDate,
        partialAmountPaid: parsedPartial,
      });
      setPayingEntry(null);
    } catch (err) {
      showError('Não foi possível atualizar o pagamento.', err);
    }
  };

  const handleDeleteEntry = async (entry: OSEntry) => {
    if (!user || entry.userId !== user.uid) {
      showError('Você não tem permissão para excluir este lançamento.');
      return;
    }
    if (!confirm('Deseja realmente excluir este lançamento?')) return;

    try {
      await deleteDoc(doc(db, 'os_entries', entry.id));
    } catch (err) {
      showError('Não foi possível excluir o lançamento.', err);
    }
  };

  const handleAddServiceType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTypeName.trim()) return;

    const typeName = newTypeName.trim().replace(/\s+/g, ' ');
    if (serviceTypes.some((type) => normalizeServiceTypeName(type.name) === normalizeServiceTypeName(typeName))) {
      setFeedback('Já existe um tipo de serviço com esse nome.');
      return;
    }

    try {
      await addDoc(collection(db, 'service_types'), {
        name: typeName,
        osRequired: newTypeOSRequired,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewTypeName('');
      setNewTypeOSRequired(false);
    } catch (err) {
      showError('Não foi possível adicionar o tipo de serviço.', err);
    }
  };

  const handleDeleteServiceType = async (type: ServiceType) => {
    if (isDefaultServiceType(type)) {
      alert('Os tipos padrão não podem ser removidos.');
      return;
    }
    if (!confirm(`Deseja remover o tipo de serviço "${type.name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'service_types', type.id));
      if (serviceType === type.name) {
        const nextType = serviceTypes.find((candidate) => candidate.id !== type.id);
        setServiceType(nextType?.name || '');
      }
    } catch (err) {
      showError('Não foi possível remover o tipo de serviço.', err);
    }
  };

  const handleAddQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newQuickNote.trim()) return;

    try {
      await addDoc(collection(db, 'quick_notes'), {
        text: newQuickNote.trim(),
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewQuickNote('');
      setShowAddQuickNote(false);
    } catch (err) {
      showError('Não foi possível salvar o modelo de observação.', err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesStatus = statusFilter === 'Todos' || entry.status === statusFilter;
    
    // Filtro por Mês (ignorado se houver filtro de data específica)
    const entryMonth = entry.date.substring(0, 7); // YYYY-MM
    const matchesMonth = (startDateFilter || endDateFilter) || !monthFilter || entryMonth === monthFilter;

    // Filtro por Data Inicial (se fornecido)
    const matchesStartDate = !startDateFilter || entry.date >= startDateFilter;
    
    // Filtro por Data Final (se fornecido)
    const matchesEndDate = !endDateFilter || entry.date <= endDateFilter;
    
    // Filtro por Nº da OS (se fornecido, case-insensitive)
    const matchesOSNumber = !osNumberFilter || (entry.osNumber && entry.osNumber.toLowerCase().includes(osNumberFilter.toLowerCase()));
    
    const matchesTab = activeTab === 'Geral' || 
                       entry.serviceType === activeTab || 
                       (activeTab === 'Outros' && entry.serviceType === 'Vendas');
                       
    return matchesStatus && matchesMonth && matchesStartDate && matchesEndDate && matchesOSNumber && matchesTab;
  });

  // Sort entries
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    const direction = sortDirection === 'asc' ? 1 : -1;

    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * direction;
    }

    return String(valA ?? '').localeCompare(String(valB ?? '')) * direction;
  });

  const handleSort = (field: 'date' | 'serviceType' | 'value' | 'notes' | 'status') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: 'date' | 'serviceType' | 'value' | 'notes' | 'status') => {
    if (sortField !== field) {
      return <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="inline h-3.5 w-3.5 ml-1 text-indigo-500" />
      : <ArrowDown className="inline h-3.5 w-3.5 ml-1 text-indigo-500" />;
  };

  // Calculate Metrics
  const countEntries = filteredEntries.length;
  const avgTicket = countEntries > 0 ? filteredEntries.reduce((sum, e) => sum + e.value, 0) / countEntries : 0;
  const totalMonth = filteredEntries.reduce((sum, entry) => sum + entry.value, 0);

  const totalPaid = filteredEntries.reduce((sum, entry) => {
    if (entry.status === 'Pago') {
      return sum + entry.value;
    } else if (entry.status === 'Pago Parcialmente') {
      return sum + (entry.partialAmountPaid || 0);
    }
    return sum;
  }, 0);

  const totalPending = totalMonth - totalPaid;
  const paymentRate = totalMonth > 0 ? (totalPaid / totalMonth) * 100 : 0;

  // Get distinct months for filter
  const distinctMonths = Array.from(
    new Set(entries.map(e => e.date.substring(0, 7)))
  ).sort((a, b) => b.localeCompare(a)); // Descending order

  const currentMonthStr = getLocalDate().substring(0, 7);
  if (!distinctMonths.includes(currentMonthStr)) {
    distinctMonths.unshift(currentMonthStr);
  }

  // Generate WhatsApp text message
  const handleCopyWhatsAppMessage = () => {
    const pendingEntries = filteredEntries.filter(e => e.status === 'Pendente' || e.status === 'Pago Parcialmente');
    if (pendingEntries.length === 0) {
      alert('Não há lançamentos pendentes ou parciais para gerar cobrança.');
      return;
    }

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    let monthLabel = '';
    if (startDateFilter || endDateFilter) {
      const startLabel = startDateFilter ? formatDate(startDateFilter) : 'Início';
      const endLabel = endDateFilter ? formatDate(endDateFilter) : 'Fim';
      monthLabel = `${startLabel} até ${endLabel}`;
    } else if (monthFilter) {
      const [year, month] = monthFilter.split('-');
      monthLabel = `${monthNames[parseInt(month) - 1]} de ${year}`;
    } else {
      monthLabel = 'Todos os meses';
    }

    let message = `*Cobrança - Serviços Prestados*\n`;
    message += `----------------------------------\n`;
    message += `*Período:* ${monthLabel}\n\n`;
    message += `*Lista de Serviços Pendentes:*\n`;

    pendingEntries.forEach((entry) => {
      const osLabel = entry.osNumber ? ` (OS #${entry.osNumber})` : '';
      if (entry.status === 'Pago Parcialmente' && entry.partialAmountPaid !== undefined) {
        const remaining = entry.value - entry.partialAmountPaid;
        message += `- ${formatDate(entry.date)}: ${entry.serviceType}${osLabel} - Total: ${formatCurrency(entry.value)} (Pago Parcialmente: ${formatCurrency(entry.partialAmountPaid)} | *Restante: ${formatCurrency(remaining)}*)\n`;
      } else {
        message += `- ${formatDate(entry.date)}: ${entry.serviceType}${osLabel} - *${formatCurrency(entry.value)}*\n`;
      }
    });

    message += `\n*Valor Total Cobrado Pendente: ${formatCurrency(totalPending)}*\n`;
    message += `----------------------------------\n`;
    message += `Por favor, realize o pagamento. Qualquer dúvida, estou à disposição. Obrigado!`;

    navigator.clipboard.writeText(message).then(() => {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 3000);
    }).catch(err => {
      showError('Não foi possível copiar a cobrança.', err);
    });
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    let monthLabel = 'Todos os meses';
    if (startDateFilter || endDateFilter) {
      const startLabel = startDateFilter ? formatDate(startDateFilter) : 'Início';
      const endLabel = endDateFilter ? formatDate(endDateFilter) : 'Fim';
      monthLabel = `${startLabel} até ${endLabel}`;
    } else if (monthFilter) {
      const [year, month] = monthFilter.split('-');
      monthLabel = `${monthNames[parseInt(month) - 1]} de ${year}`;
    }

    const reportTitle = `Relatório de Serviços: ${activeTab}`;
    const safeReportTitle = escapeHtml(reportTitle);
    const safeMonthLabel = escapeHtml(monthLabel);
    const entriesRows = filteredEntries.map(entry => {
      let statusDetail: string = entry.status;
      if (entry.status === 'Pago Parcialmente' && entry.partialAmountPaid !== undefined) {
        statusDetail = `Parcial (Pago: ${formatCurrency(entry.partialAmountPaid)} | Resta: ${formatCurrency(entry.value - entry.partialAmountPaid)})`;
      }
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(formatDate(entry.date))}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(entry.serviceType)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">${escapeHtml(entry.osNumber || '-')}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">${escapeHtml(formatCurrency(entry.value))}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">${escapeHtml(entry.notes || '-')}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
            <span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; background-color: ${
              entry.status === 'Pago' ? '#DEF7EC' : entry.status === 'Pago Parcialmente' ? '#E1F5FE' : '#FEF08A'
            }; color: ${
              entry.status === 'Pago' ? '#03543F' : entry.status === 'Pago Parcialmente' ? '#0277BD' : '#713F12'
            }">
              ${escapeHtml(statusDetail)}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${safeReportTitle}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { font-size: 26px; color: #0f172a; margin: 0 0 8px 0; }
            .meta { font-size: 13px; color: #64748b; margin: 0; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 35px; }
            .kpi { padding: 18px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #f8fafc; }
            .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.05em; }
            .kpi-value { font-size: 22px; font-weight: bold; color: #0f172a; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f1f5f9; padding: 12px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #475569; }
            td { font-size: 14px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${safeReportTitle}</h1>
            <p class="meta">Gerado em ${escapeHtml(new Date().toLocaleDateString('pt-BR'))} às ${escapeHtml(new Date().toLocaleTimeString('pt-BR'))} | Período: ${safeMonthLabel}</p>
          </div>
          
          <div class="kpis">
            <div class="kpi">
              <div class="kpi-title">Faturamento Total</div>
              <div class="kpi-value">${formatCurrency(totalMonth)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Total Recebido</div>
              <div class="kpi-value">${formatCurrency(totalPaid)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Total Pendente</div>
              <div class="kpi-value">${formatCurrency(totalPending)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Qtd. Serviços</div>
              <div class="kpi-value">${countEntries}</div>
            </div>
          </div>
          
          <h2 style="font-size: 16px; color: #0f172a; margin-bottom: 15px;">Detalhamento das Operações</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Serviço</th>
                <th>OS</th>
                <th>Valor</th>
                <th>Observação</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${entriesRows}
            </tbody>
          </table>

          <div class="footer">
            <p>Relatório Profissional de Gestão de Ordens de Serviço</p>
          </div>
          
          <script>
            window.onload = function() { 
              setTimeout(function() { window.print(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isOSRequired = serviceTypes.find(t => t.name === serviceType)?.osRequired || false;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-905 transition-colors duration-300">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col">
      {feedback && (
        <div className="fixed bottom-4 right-4 z-50 bg-rose-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-4 animate-fade-in">
          <span className="text-sm font-medium">{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-white/80 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-1 ring-indigo-500/20">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Gestão de OS</h1>
              <span className="text-xs text-slate-500 dark:text-slate-400">Serviços Prestados</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-655 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/40 px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-white/5">
              <User className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span>{user.email}</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition duration-200"
              title="Alternar tema"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            <button
              onClick={() => setShowConfigTypes(true)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition duration-200"
              title="Configurar tipos de serviços"
            >
              <Settings className="h-5 w-5" />
            </button>

            <button
              onClick={async () => {
                try {
                  await logout();
                } catch (err) {
                  showError('Não foi possível sair da conta.', err);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-500 dark:text-rose-455 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Tabs (Service Spaces) */}
        <div className="flex border-b border-slate-200 dark:border-slate-850 overflow-x-auto scrollbar-none gap-2 pb-px">
          <button
            onClick={() => setActiveTab('Geral')}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition duration-200 focus:outline-none ${
              activeTab === 'Geral'
                ? 'border-indigo-500 text-indigo-650 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Visão Geral
          </button>
          {serviceTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveTab(type.name)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition duration-200 focus:outline-none ${
                activeTab === type.name
                  ? 'border-indigo-500 text-indigo-605 dark:text-indigo-400 font-semibold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {type.name}
            </button>
          ))}
        </div>

        {/* Indicators Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Total Month */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/10 to-indigo-500/5 dark:from-indigo-900/40 dark:to-indigo-950/40 border border-indigo-200 dark:border-indigo-500/10 p-6 shadow-md dark:shadow-xl backdrop-blur-sm">
            <div className="absolute right-4 top-4 opacity-10">
              <TrendingUp className="h-16 w-16 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-1 ring-indigo-500/20">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300/80">Total do Mês</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totalMonth)}</h3>
              </div>
            </div>
          </div>

          {/* Card Total Paid */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 dark:from-emerald-900/40 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-500/10 p-6 shadow-md dark:shadow-xl backdrop-blur-sm">
            <div className="absolute right-4 top-4 opacity-10">
              <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-605 dark:text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/20">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300/80">Total Pago</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totalPaid)}</h3>
              </div>
            </div>
          </div>

          {/* Card Total Pending */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-500/5 dark:from-amber-900/40 dark:to-amber-950/40 border border-amber-200 dark:border-amber-500/10 p-6 shadow-md dark:shadow-xl backdrop-blur-sm">
            <div className="absolute right-4 top-4 opacity-10">
              <Clock className="h-16 w-16 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-1 ring-amber-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300/80">Total Pendente</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(totalPending)}</h3>
              </div>
            </div>
          </div>
        </section>

        {/* Professional Analytics Panel */}
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md dark:shadow-xl grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-650 dark:text-indigo-400">
                Adimplência / Recebimento - {activeTab}
              </h3>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {paymentRate.toFixed(1)}% Pago
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-3.5 border border-slate-200 dark:border-slate-800 overflow-hidden p-0.5">
                <div 
                  className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${paymentRate}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Demonstrativo de faturamento recebido versus pendente para o espaço <strong className="text-slate-750 dark:text-slate-300">{activeTab}</strong>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Volume de Serviços</span>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">{countEntries} lançamentos</h4>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Ticket Médio</span>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">{formatCurrency(avgTicket)}</h4>
            </div>
          </div>
        </div>

        {/* Action Grid (New Entry Form + Management) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New/Edit Entry Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md dark:shadow-xl space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-200 dark:border-slate-850">
              {editingId ? (
                <Pencil className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              ) : (
                <Plus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              )}
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId ? 'Editar Lançamento' : 'Novo Lançamento Rápido'}
              </h2>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo de Serviço</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 text-sm"
                >
                  {serviceTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name} {type.osRequired ? '(OS Obrigatória)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Número da OS {isOSRequired ? <span className="text-rose-500 font-bold">*</span> : <span className="text-slate-400 dark:text-slate-500">(Opcional)</span>}
                </label>
                <input
                  type="text"
                  value={osNumber}
                  onChange={(e) => setOsNumber(e.target.value)}
                  placeholder="Ex: 2026-001"
                  required={isOSRequired}
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor (R$)</label>
                <input
                  type="text"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">
                  {serviceType === 'Outros' ? 'Descrição / Observações' : 'Observações'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={serviceType === 'Outros' ? 'Detalhes adicionais, descrição do serviço ou do produto...' : 'Detalhes ou observações adicionais...'}
                  className="block w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                />
                
                {/* Quick note templates */}
                <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                  {quickNotes.map((qNote, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setNotes(qNote)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800/60 transition"
                    >
                      {qNote}
                    </button>
                  ))}
                  
                  {showAddQuickNote ? (
                    <div className="flex items-center gap-1 mt-1 w-full sm:w-auto">
                      <input
                        type="text"
                        value={newQuickNote}
                        onChange={(e) => setNewQuickNote(e.target.value)}
                        placeholder="Nova observação..."
                        className="text-[11px] px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-650"
                      />
                      <button
                        type="button"
                        onClick={handleAddQuickNote}
                        className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-lg hover:bg-indigo-550 transition font-medium"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddQuickNote(false)}
                        className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddQuickNote(true)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold px-2 py-0.5 flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Add modelo
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status Inicial</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Pendente', 'Pago', 'Pago Parcialmente'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatus(s);
                        if (s !== 'Pendente' && !paymentDate) {
                          setPaymentDate(getLocalDate());
                        }
                      }}
                      className={`py-2 text-[10px] font-semibold rounded-xl border transition-all truncate ${
                        status === s
                          ? s === 'Pago'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : s === 'Pago Parcialmente'
                            ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400'
                            : 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {status !== 'Pendente' && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Método</label>
                    <select
                      value={paymentMethod || 'Pix'}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="mt-1.5 block w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 text-xs"
                    >
                      <option value="Pix">Pix</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Parcelado">Parcelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data do Pago</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="mt-1.5 block w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 text-xs"
                    />
                  </div>
                </div>
              )}

              {status === 'Pago Parcialmente' && (
                <div className="animate-fade-in space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor Pago (R$)</label>
                  <input
                    type="text"
                    required
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0,00"
                    className="block w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 text-xs font-semibold"
                  />
                  {value && partialAmount && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Resta pagar: {formatCurrency(Math.max(0, parseFloat(value.replace(',', '.')) - parseFloat(partialAmount.replace(',', '.')) || 0))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all duration-200"
              >
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? 'Salvar Alterações' : 'Salvar Lançamento'}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 text-sm font-semibold transition duration-200"
                >
                  Cancelar Edição
                </button>
              )}
            </form>
          </div>

          {/* Interactive List and Filters */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-md dark:shadow-xl flex flex-col">
            
            {/* Filter controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Lançamentos</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* OS Number Filter */}
                <input
                  type="text"
                  value={osNumberFilter}
                  onChange={(e) => setOsNumberFilter(e.target.value)}
                  placeholder="Filtrar por Nº OS"
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 w-36"
                />

                {/* Period Date Filters */}
                <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-950/50 px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value);
                      setMonthFilter(''); // Limpa o mês se o usuário escolher período específico
                    }}
                    className="bg-transparent border-none text-sm focus:outline-none text-slate-850 dark:text-slate-200 focus:ring-0 focus:ring-transparent"
                    title="Data Inicial"
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setMonthFilter(''); // Limpa o mês se o usuário escolher período específico
                    }}
                    className="bg-transparent border-none text-sm focus:outline-none text-slate-850 dark:text-slate-200 focus:ring-0 focus:ring-transparent"
                    title="Data Final"
                  />
                </div>

                {/* Month selector */}
                <select
                  value={monthFilter}
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    setStartDateFilter(''); // Limpa a data inicial
                    setEndDateFilter(''); // Limpa a data final
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200"
                >
                  <option value="">Todos os Meses</option>
                  {distinctMonths.map((m) => {
                    const [year, month] = m.split('-');
                    const monthNames = [
                      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
                    ];
                    return (
                      <option key={m} value={m}>
                        {monthNames[parseInt(month) - 1]} / {year}
                      </option>
                    );
                  })}
                </select>

                {/* Status Filter selector */}
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-950 p-0.5 border border-slate-200 dark:border-slate-800">
                  {(['Todos', 'Pago', 'Pendente'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        statusFilter === s
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* WhatsApp copy button */}
                <button
                  onClick={handleCopyWhatsAppMessage}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition duration-200 ${
                    copiedMessage
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-200 dark:border-indigo-500/10'
                  }`}
                  title="Copiar cobrança para WhatsApp"
                >
                  {copiedMessage ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 animate-bounce" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-3.5 w-3.5" />
                      Copia Whatsapp
                    </>
                  )}
                </button>

                {/* Print Report button */}
                <button
                  onClick={handlePrintReport}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition duration-200"
                  title="Imprimir Relatório Profissional"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  Imprimir Relatório
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-x-auto mt-4">
              {loadingEntries ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <span className="text-sm text-slate-500">Carregando lançamentos...</span>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nenhum lançamento encontrado</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Experimente alterar os filtros ou registrar um novo serviço.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-900 text-xs font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none group" onClick={() => handleSort('date')}>
                        <div className="flex items-center">
                          Data {renderSortIcon('date')}
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none group" onClick={() => handleSort('serviceType')}>
                        <div className="flex items-center">
                          Serviço / OS {renderSortIcon('serviceType')}
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none group" onClick={() => handleSort('value')}>
                        <div className="flex items-center">
                          Valor {renderSortIcon('value')}
                        </div>
                      </th>
                      <th className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none group" onClick={() => handleSort('notes')}>
                        <div className="flex items-center">
                          Observação {renderSortIcon('notes')}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none group" onClick={() => handleSort('status')}>
                        <div className="flex items-center justify-center">
                          Status {renderSortIcon('status')}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right select-none">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-900 text-sm">
                    {sortedEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-100/30 dark:hover:bg-slate-900/20 group transition">
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {formatDate(entry.date)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{entry.serviceType}</div>
                          {entry.osNumber && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded ring-1 ring-slate-200 dark:ring-white/5 font-mono">
                              OS: {entry.osNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          {formatCurrency(entry.value)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={entry.notes}>
                          {entry.notes || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => handleToggleStatus(entry)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 transition cursor-pointer hover:scale-105 duration-200 ${
                                entry.status === 'Pago'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30'
                                  : entry.status === 'Pago Parcialmente'
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/30'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/30'
                              }`}
                              title="Clique para editar detalhes do pagamento"
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                entry.status === 'Pago' 
                                  ? 'bg-emerald-500 dark:bg-emerald-400' 
                                  : entry.status === 'Pago Parcialmente'
                                  ? 'bg-sky-500 dark:bg-sky-400'
                                  : 'bg-amber-500 dark:bg-amber-400'
                              }`} />
                              {entry.status}
                            </button>
                            {entry.status !== 'Pendente' && (
                              <span className="text-[10px] text-slate-500 flex flex-col items-center">
                                <span>{entry.paymentMethod} - {entry.paymentDate ? formatDate(entry.paymentDate).substring(0, 5) : ''}</span>
                                {entry.status === 'Pago Parcialmente' && entry.partialAmountPaid !== undefined && (
                                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                    Pago: {formatCurrency(entry.partialAmountPaid)} | Resta: {formatCurrency(Math.max(0, entry.value - entry.partialAmountPaid))}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleStartEdit(entry)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 rounded transition duration-200 mr-2 md:opacity-0 md:group-hover:opacity-100"
                            title="Editar lançamento"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry)}
                            className="p-1 text-slate-400 hover:text-rose-500 dark:text-slate-550 dark:hover:text-rose-400 rounded transition duration-200 md:opacity-0 md:group-hover:opacity-100"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Config Modals */}
      {showConfigTypes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative text-slate-900 dark:text-white">
            <button
              type="button"
              onClick={() => setShowConfigTypes(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              Tipos de Serviços
            </h2>

            <div className="space-y-2.5 max-h-60 overflow-y-auto mb-6 pr-2">
              {serviceTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-705 transition"
                >
                  <div>
                    <span className="font-semibold">{type.name}</span>
                    {type.osRequired && (
                      <span className="ml-2 text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20 px-1.5 py-0.5 rounded-full font-medium">
                        OS Obrigatória
                      </span>
                    )}
                  </div>
                  {!['1', '2', '3'].includes(type.id) ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteServiceType(type)}
                      className="p-1 text-slate-500 hover:text-rose-500 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium italic">Padrão</span>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddServiceType} className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Adicionar Novo Tipo</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Nome do Tipo</label>
                  <input
                    type="text"
                    required
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Ex: Consultoria"
                    className="mt-1.5 block w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={newTypeOSRequired}
                      onChange={(e) => setNewTypeOSRequired(e.target.checked)}
                      className="rounded border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 text-indigo-600 dark:text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Requer número da OS
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Adicionar Tipo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Details Quick Modal */}
      {payingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <h3 className="text-base font-bold">Atualizar Pagamento</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajuste o status e informações de pagamento para o serviço <strong className="text-slate-800 dark:text-slate-200">{payingEntry.serviceType}</strong>.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Pendente', 'Pago', 'Pago Parcialmente'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPayingStatus(s)}
                      className={`py-2 text-[10px] font-semibold rounded-xl border transition-all ${
                        payingStatus === s
                          ? s === 'Pago'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : s === 'Pago Parcialmente'
                            ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400'
                            : 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {payingStatus !== 'Pendente' && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-555 dark:text-slate-400 tracking-wider">Método</label>
                    <select
                      value={payingMethod || 'Pix'}
                      onChange={(e) => setPayingMethod(e.target.value as PaymentMethod)}
                      className="mt-1.5 block w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 text-xs"
                    >
                      <option value="Pix">Pix</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Parcelado">Parcelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-555 dark:text-slate-400 tracking-wider">Data do Pago</label>
                    <input
                      type="date"
                      required
                      value={payingDate}
                      onChange={(e) => setPayingDate(e.target.value)}
                      className="mt-1.5 block w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 text-xs"
                    />
                  </div>
                </div>
              )}

              {payingStatus === 'Pago Parcialmente' && (
                <div className="animate-fade-in space-y-1.5">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wider">Valor Pago (R$)</label>
                  <input
                    type="text"
                    required
                    value={payingPartialAmount}
                    onChange={(e) => setPayingPartialAmount(e.target.value)}
                    placeholder="0,00"
                    className="block w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-slate-200 text-xs font-semibold"
                  />
                  {payingEntry && payingPartialAmount && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Resta pagar: {formatCurrency(Math.max(0, payingEntry.value - parseFloat(payingPartialAmount.replace(',', '.')) || 0))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingEntry(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePaymentDetails}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
