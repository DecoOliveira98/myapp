import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

type Props = {
  session: Session;
  onClose: () => void;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

const SUGGESTIONS = [
  'Quanto de proteína comi hoje?',
  'Estou no caminho certo pra minha meta?',
  'Sugira um almoço com 600 kcal',
];

export default function ChatScreen({ session, onClose }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    async function load() {
      const { data: convs } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        setConversationId(convs[0].id);
        const { data: msgs } = await supabase
          .from('ai_messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', convs[0].id)
          .order('created_at', { ascending: true });
        setMessages((msgs as Message[]) ?? []);
      }
      setLoadingHistory(false);
    }
    load();
  }, [session.user.id]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('chat-ai', {
        body: { conversation_id: conversationId, user_message: text },
      });
      if (invokeErr) throw new Error(invokeErr.message);
      if ((data as any).error) throw new Error((data as any).error);

      const cid = (data as any).conversation_id as string;
      const reply = (data as any).assistant_message as {
        id: string;
        content: string;
        created_at: string;
      };

      if (!conversationId) setConversationId(cid);
      setMessages((prev) => [
        ...prev,
        { id: reply.id, role: 'assistant', content: reply.content, created_at: reply.created_at },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  }

  // FlatList is inverted: index 0 = bottom. "Pensando..." must be index 0 when sending.
  const displayMessages: Message[] = sending
    ? [{ id: '__thinking__', role: 'assistant', content: 'Pensando...' }, ...[...messages].reverse()]
    : [...messages].reverse();

  const isEmpty = !loadingHistory && messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Conversa</Text>
      </View>

      {/* Body */}
      {loadingHistory ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#222" />
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Pergunte qualquer coisa sobre suas refeições, peso ou metas.
          </Text>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggestion}
              onPress={() => {
                setInput(s);
                inputRef.current?.focus();
              }}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          data={displayMessages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                  item.id === '__thinking__' && styles.thinkingText,
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
        />
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {error !== null && <Text style={styles.errorText}>{error}</Text>}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            multiline
            placeholder="Pergunte algo..."
            placeholderTextColor="#aaa"
            textAlignVertical="top"
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backText: {
    fontSize: 15,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  bubbleUser: {
    backgroundColor: '#222',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#f3f3f3',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTextAssistant: {
    color: '#111',
  },
  thinkingText: {
    color: '#999',
    fontStyle: 'italic',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    fontSize: 15,
    color: '#111',
    maxHeight: 80,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
  sendBtnText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
});
