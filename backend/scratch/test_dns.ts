import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.resolveSrv('_mongodb._tcp.bizreply.8li9geq.mongodb.net', (err, addresses) => {
  console.log('Error:', err);
  console.log('Addresses:', addresses);
});
