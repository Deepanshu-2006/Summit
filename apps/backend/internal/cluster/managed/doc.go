// Package managed provisions single-replica Postgres and Redis workloads in a
// tenant namespace.
//
// Each addon is one Secret, one headless Service, and one StatefulSet with a
// single PVC. Redeploys update that StatefulSet in place and never replace the
// volume. There is no backup CronJob, dump, WAL archive, volume snapshot, or
// standby replica. Deleting the service deletes the StatefulSet and its PVC,
// which deletes the data.
package managed
