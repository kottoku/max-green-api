import { useEffect, useRef, useState } from 'react'

const savedId = localStorage.getItem('idInstance') || ''
const savedToken = localStorage.getItem('apiTokenInstance') || ''
const savedApiUrl = localStorage.getItem('apiUrl') || ''

function App() {
  const [idInstance, setIdInstance] = useState(savedId)
  const [apiToken, setApiToken] = useState(savedToken)
  const [apiUrl, setApiUrl] = useState(savedApiUrl)
  const [phone, setPhone] = useState('')
  const [chat, setChat] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const activeChatId = useRef('')

  const baseUrl = apiUrl.trim().replace(/\/+$/, '')

  useEffect(() => {
    if (!baseUrl || !idInstance || !apiToken || !chat) return undefined

    let isCancelled = false

    const poll = async () => {
      while (!isCancelled) {
        try {
          const response = await fetch(
            `${baseUrl}/waInstance${idInstance}/receiveNotification/${apiToken}`,
          )
          if (response.status !== 408 && response.ok) {
            const data = await response.json()
            console.log('Входящие данные:', data)

            const body = data?.body || {}
            const incomingText =
              body.messageData?.textMessageData?.textMessage ||
              body.messageData?.extendedTextMessageData?.text ||
              body.textMessage ||
              body.message ||
              ''
            const sender = String(
              body.senderData?.chatId || body.senderData?.sender || body.chatId || '',
            )
            const cleanSender = sender.replace(/\D/g, '')
            const resolvedChat = String(activeChatId.current || '').replace(/\D/g, '')
            const msgId = body.idMessage

            if (
              !isCancelled &&
              incomingText &&
              body.typeWebhook === 'incomingMessageReceived' &&
              cleanSender === resolvedChat
            ) {
              setMessages((prev) => {
                if (msgId && prev.some((item) => item.id === msgId)) return prev
                return [...prev, { id: msgId, text: incomingText, sender: 'their', incoming: true }]
              })
            }

            if (data?.receiptId) {
              try {
                await fetch(
                  `${baseUrl}/waInstance${idInstance}/deleteNotification/${apiToken}/${data.receiptId}`,
                  { method: 'DELETE' },
                )
              } catch (error) {
                console.error('Ошибка удаления:', error)
              }
            }
          }
        } catch (error) {
          console.error('Ошибка получения сообщений:', error)
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    poll()
    return () => {
      isCancelled = true
    }
  }, [baseUrl, idInstance, apiToken, chat])

  const saveSettings = (event) => {
    event.preventDefault()
    localStorage.setItem('idInstance', idInstance)
    localStorage.setItem('apiTokenInstance', apiToken)
    localStorage.setItem('apiUrl', apiUrl)
    setStatus('Данные сохранены')
  }

  const openChat = async (event) => {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (!digits) return

    setChat(digits)
    activeChatId.current = digits
    setMessages([])
    setStatus('')

    if (digits.length !== 11 || !baseUrl || !idInstance || !apiToken) return

    try {
      const response = await fetch(
        `${baseUrl}/waInstance${idInstance}/checkAccount/${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: Number(digits) }),
        },
      )
      const result = await response.json()
      if (response.ok && result.exist && result.chatId) {
        activeChatId.current = String(result.chatId)
      }
    } catch {

    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!message.trim() || !chat || !apiUrl || !idInstance || !apiToken) return

    setLoading(true)
    setStatus('')

    const baseUrl = (apiUrl || '').trim().replace(/\/+$/, '')
    const sendUrl = `${baseUrl}/waInstance${idInstance}/sendMessage/${apiToken}`
    const body = {
      chatId: String(activeChatId.current || chat),
      message: message,
    }

    // console.log('url отправки:', sendUrl) 
    // console.log('тело запроса:', body)

    try {
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      console.log('Ответ сервера на отправку:', data)
      if (!res.ok) throw new Error()

      const msgId = data?.idMessage
      setMessages((current) => {
        if (msgId && current.some((item) => item.id === msgId)) return current
        return [...current, { id: msgId, text: message, incoming: false }]
      })
      setMessage('')
    } catch {
      setStatus('Не удалось отправить сообщение')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <main className="page">
      <section className="settings">
        <h1>MAX чат</h1>
        <p className="hint">Подключение через GREEN-API</p>
        <form onSubmit={saveSettings}>
          <label>API URL MAX</label>
          <input
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder="https://host.api.green-api.com"
          />
          <label>ID instance</label>
          <input
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            placeholder="idInstance"
          />
          <label>API token instance</label>
          <input
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder="apiTokenInstance"
            type="password"
          />
          <button className="save" type="submit">Сохранить</button>
        </form>
        <div className="new-chat">
          <h2>Новый чат</h2>
          <form onSubmit={openChat}>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Номер телефона или MAX chatId"
            />
            <button type="submit">Открыть чат</button>
          </form>
        </div>
      </section>

      <section className="chat">
        <header>
          <div className="avatar">{chat ? chat.slice(-2) : ''}</div>
          <div>
            <strong>{chat || 'Выберите чат'}</strong>
            <small>{chat ? 'MAX' : 'Введите номер слева'}</small>
          </div>
        </header>
        <div className="messages">
          {!chat && <div className="empty">Здесь появятся ваши сообщения</div>}
          {messages.map((item, index) => (
            <div
              className={`bubble ${item.incoming ? 'incoming' : 'outgoing'}`}
              key={`${item.text}-${index}`}
            >
              {item.text}
            </div>
          ))}
        </div>
        {status && <div className="status">{status}</div>}
        <form className="composer" onSubmit={sendMessage}>
          <input
            ref={inputRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Введите сообщение"
            disabled={!chat}
          />
          <button type="submit" disabled={!chat || loading}>
            {loading ? '...' : '➤'}
          </button> 
        </form>
      </section>
    </main>
  )
  // https://emojidb.org/send-emojis "➤" был взят отсюда 
}

export default App
