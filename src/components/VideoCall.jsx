export default function VideoCall({ remoteVideoRef, photoUrl, streamAvailable }) {
  return (
    <div style={styles.container}>
      <video ref={remoteVideoRef} autoPlay playsInline muted
        style={{ ...styles.video, zIndex: 2, opacity: streamAvailable ? 1 : 0 }}
      />
      {!streamAvailable && photoUrl && (
        <div style={styles.photoWrap}><img src={photoUrl} alt="" style={styles.photo} /></div>
      )}
      {!streamAvailable && !photoUrl && <div style={styles.noVideo}><p style={{fontSize:64}}>👤</p></div>}
      <div style={styles.gradientTop} /><div style={styles.gradientBottom} />
    </div>
  );
}
const styles={
  container:{position:'absolute',top:0,left:0,width:'100%',height:'100%',background:'#000',zIndex:1},
  video:{width:'100%',height:'100%',objectFit:'cover',position:'absolute',top:0,left:0},
  photoWrap:{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:1},
  photo:{width:'100%',height:'100%',objectFit:'cover'},
  noVideo:{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#111'},
  gradientTop:{position:'absolute',top:0,left:0,right:0,height:100,background:'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',pointerEvents:'none'},
  gradientBottom:{position:'absolute',bottom:0,left:0,right:0,height:160,background:'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',pointerEvents:'none'},
};
