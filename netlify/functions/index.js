exports.releaseEarnings = functions.pubsub
  .schedule('every 10 minutes')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now()

    const snap = await admin.firestore()
      .collectionGroup('transactions')
      .where('status', '==', 'pending')
      .where('releaseAt', '<=', now)
      .get()

    const batch = admin.firestore().batch()

    snap.docs.forEach(doc => {
      const txData = doc.data()
      const hostRef =
        admin.firestore().collection('users').doc(txData.to)

      batch.update(hostRef, {
        earnings_pending:
          admin.firestore.FieldValue.increment(-txData.amount),
        earnings_available:
          admin.firestore.FieldValue.increment(txData.amount)
      })

      batch.update(doc.ref, {
        status: 'available'
      })
    })

    await batch.commit()
  })
