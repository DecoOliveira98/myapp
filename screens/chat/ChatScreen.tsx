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
import { T } from '../../theme/tokens';

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
          <ActivityIndicator size="large" color={T.accent} />
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
            placeholderTextColor={T.textTertiary}
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
    backgroundColor: T.bgBase,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: T.sp5,
    paddingBottom: T.sp4,
    borderBottomWidth: 1,
    borderBottomColor: T.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp3,
  },
  backText: {
    fontSize: T.textSm,
    color: T.textSecondary,
    fontFamily: T.fontMono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: T.textMd,
    color: T.textPrimary,
    fontFamily: T.fontDisplay,
    letterSpacing: -0.2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    padding: T.sp5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: T.textBase,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: T.sp5,
    fontFamily: T.fontBody,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: T.borderSoft,
    paddingVertical: T.sp3,
    paddingHorizontal: T.sp4,
    marginBottom: T.sp3,
    alignSelf: 'stretch',
    backgroundColor: T.surface1,
  },
  suggestionText: {
    fontSize: T.textSm,
    color: T.textPrimary,
    textAlign: 'center',
    fontFamily: T.fontBody,
  },
  listContent: {
    paddingHorizontal: T.sp4,
    paddingVertical: T.sp3,
  },
  bubble: {
    maxWidth: '84%',
    paddingHorizontal: T.sp3,
    paddingVertical: T.sp2,
    marginBottom: T.sp2,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: T.accent,
    borderColor: T.accent,
    alignSelf: 'flex-end',
  },
  bubbleAssistant: {
    backgroundColor: T.surface1,
    borderColor: T.borderSoft,
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: T.textBase,
    lineHeight: 21,
    fontFamily: T.fontBody,
  },
  bubbleTextUser: {
    color: T.bgBase,
  },
  bubbleTextAssistant: {
    color: T.textPrimary,
  },
  thinkingText: {
    color: T.textTertiary,
    fontStyle: 'italic',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: T.borderSoft,
    paddingHorizontal: T.sp4,
    paddingVertical: T.sp3,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: T.bgBase,
  },
  errorText: {
    color: T.danger,
    fontSize: T.textXs,
    marginBottom: T.sp2,
    textAlign: 'center',
    fontFamily: T.fontBody,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: T.sp2,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.borderSoft,
    paddingHorizontal: T.sp4,
    paddingVertical: T.sp3,
    backgroundColor: T.surface1,
    fontSize: T.textBase,
    color: T.textPrimary,
    maxHeight: 80,
    fontFamily: T.fontBody,
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: T.accent,
    borderWidth: 1,
    borderColor: T.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: T.surface3,
    borderColor: T.surface3,
  },
  sendBtnText: {
    fontSize: T.textMd,
    color: T.bgBase,
    fontFamily: T.fontMonoMedium,
  },
});
